import { NextRequest, NextResponse } from "next/server";
import {
  getSessionUser,
  getUserFromToken,
  SESSION_COOKIE,
} from "@/lib/auth";
import {
  subscribe,
  unsubscribe,
  userConnCount,
} from "@/lib/notifications/hub";
import { rateLimit } from "@/lib/rate-limit";

// Živý zvoneček (M7). SSE stream per uživatel: server po vzniku notifikace pošle
// signál „notifications" (bez dat), klient přenačte /api/notifications. Stejné
// zpevnění jako u přítomnosti (rate-limit, strop spojení, heartbeat re-auth).
//
// SSE potřebuje běžící Node server - dlouhé spojení, žádné cachování.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;
// Strop souběžných spojení jednoho uživatele (víc záložek OK, ne neomezeně) +
// rate-limit na otevírání spojení (proti reconnect stormu). Security review M7.
const MAX_CONNS_PER_USER = 8;

// GET /api/notifications/stream - SSE stream signálů o nových notifikacích.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`notif-stream:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho spojení, chvíli počkejte." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  if (userConnCount(user.id) >= MAX_CONNS_PER_USER) {
    return NextResponse.json(
      { error: "Příliš mnoho otevřených spojení." },
      { status: 429 },
    );
  }

  // connId generuje SERVER (ne z query) — vyloučí přepis cizího spojení.
  const connId = crypto.randomUUID();
  // Token zachytíme teď - heartbeat ho re-ověří (v intervalu už není cookies()).
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = user.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // spojení spadlo - uklidí cleanup
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(hb);
        unsubscribe(userId, connId);
        try {
          controller.close();
        } catch {
          // už zavřeno
        }
      };

      try {
        controller.enqueue(encoder.encode(": connected\n\n"));
      } catch {
        // pokud hned spadne, cleanup níže
      }
      subscribe(userId, { connId, send });

      // Heartbeat: udrž spojení + re-ověř session (deaktivace / odhlášení ukončí
      // stream). Krátký výpadek DB NESMÍ shodit callback do unhandled rejection.
      const hb = setInterval(async () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
          return;
        }
        try {
          const u = await getUserFromToken(token);
          if (!u) {
            cleanup();
            return;
          }
        } catch {
          // DB krátce nedostupná — spojení nech běžet, re-check příště.
        }
      }, HEARTBEAT_MS);

      // Odpojení klienta (zavření záložky / navigace) → úklid.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Vypni bufferování na reverzní proxy (jinak se SSE zadrží).
      "X-Accel-Buffering": "no",
    },
  });
}
