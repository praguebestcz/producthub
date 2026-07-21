import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  canSeeInternal,
  getSessionUser,
  getUserFromToken,
  requireProjectRole,
  SESSION_COOKIE,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { join, leave, setTyping } from "@/lib/presence/hub";

// Přítomnost u dokumentu (M7 Fáze 2). GET = SSE stream „kdo je tu / kdo píše",
// POST = signalizace psaní. Paměťový hub (1 instance na Railway).
//
// SSE potřebuje běžící server (Node) - drží dlouhé spojení, žádné cachování.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;

// Dokument + členství (READER+). Nečlen i neexistující dokument = null (404).
async function loadDoc(documentId: number, userId: number) {
  if (!Number.isInteger(documentId) || documentId <= 0) return null;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, projectId: true },
  });
  if (!document) return null;
  const member = await requireProjectRole(userId, document.projectId, "READER");
  if (!member) return null;
  return { document, member };
}

// GET /api/documents/[documentId]/presence?c=<connId> - SSE stream přítomnosti.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const ctx = await loadDoc(documentId, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }

  const connId = req.nextUrl.searchParams.get("c") || crypto.randomUUID();
  // Token zachytíme teď - heartbeat ho re-ověří (v intervalu už není cookies()).
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let currentInternal = canSeeInternal(ctx.member);

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
        leave(documentId, connId);
        try {
          controller.close();
        } catch {
          // už zavřeno
        }
      };

      // Otevři stream a přihlas se do hubu (rozešle přítomnost ostatním).
      try {
        controller.enqueue(encoder.encode(": connected\n\n"));
      } catch {
        // pokud hned spadne, cleanup níže
      }
      join(documentId, {
        connId,
        userId: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        internal: currentInternal,
        send,
      });

      // Heartbeat: udrž spojení + re-ověř session a členství (deaktivace /
      // odebrání z projektu ukončí stream; změna interního příznaku obnoví filtr).
      const hb = setInterval(async () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
          return;
        }
        const u = await getUserFromToken(token);
        if (!u) {
          cleanup();
          return;
        }
        const m = await requireProjectRole(u.id, ctx.document.projectId, "READER");
        if (!m) {
          cleanup();
          return;
        }
        const nowInternal = canSeeInternal(m);
        if (nowInternal !== currentInternal) {
          currentInternal = nowInternal;
          join(documentId, {
            connId,
            userId: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            internal: currentInternal,
            send,
          });
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

// Signál psaní: příznak + kde (stránka + prvek/vlákno). Limity jako u komentáře.
const typingSchema = z.object({
  typing: z.boolean(),
  pagePath: z.string().max(500).optional(),
  threadId: z.number().int().positive().nullish(),
  dataReviewId: z.string().max(200).nullish(),
  domPath: z.string().max(2000).nullish(),
});

// POST /api/documents/[documentId]/presence - „píše (kde) / přestal psát".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const ctx = await loadDoc(documentId, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }
  const parsed = typingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatný vstup" }, { status: 400 });
  }
  const { typing, pagePath, threadId, dataReviewId, domPath } = parsed.data;
  // Píše se jen za svého uživatele (userId ze session), hub ověří přítomnost.
  const info =
    typing && pagePath
      ? {
          pagePath,
          threadId: threadId ?? null,
          dataReviewId: dataReviewId ?? null,
          domPath: domPath ?? null,
        }
      : null;
  setTyping(documentId, user.id, typing, info);
  return NextResponse.json({ ok: true });
}
