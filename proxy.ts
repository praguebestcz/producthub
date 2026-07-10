import { NextRequest, NextResponse } from "next/server";
import {
  verifySessionToken,
  signSessionToken,
  SESSION_TTL_SEC,
  SESSION_REISSUE_AFTER_SEC,
} from "@/lib/jwt";
import { SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// V Next.js 16 se dřívější `middleware.ts` jmenuje `proxy.ts` a funkce `proxy`.
// Kombinuje dvě věci (vzor vratky):
//   1) correlation ID (UUID) pro každý request — stopování chyb
//   2) ochranu aplikace — VŠE kromě veřejných cest vyžaduje platnou session
//
// Proxy v Next 16 běží defaultně na Node.js runtime, takže jose i Prisma fungují.

// Veřejné cesty (bez přihlášení):
//  - /login (přihlašovací stránka)
//  - /api/auth/* (Google OAuth tok + logout)
//  - /view/* (zobrazení dokumentu — má vlastní autorizaci přes view token, M5)
function isPublicPath(path: string): boolean {
  return (
    path === "/login" ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/view/")
  );
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // --- correlation ID (pro všechny requesty) ---
  const correlationId =
    req.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-correlation-id", correlationId);

  const withCorrelation = (res: NextResponse) => {
    res.headers.set("x-correlation-id", correlationId);
    return res;
  };

  if (isPublicPath(path)) {
    return withCorrelation(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  // --- ochrana všeho ostatního ---
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  // Platná relace = platný podpis + typ "session" + lístek vydaný až PO
  // `tokenValidFrom` uživatele (zneplatní staré relace po odhlášení všech zařízení).
  let valid = !!payload;
  if (payload) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenValidFrom: true },
    });
    if (
      !user ||
      typeof payload.iat !== "number" ||
      payload.iat < Math.floor(user.tokenValidFrom.getTime() / 1000)
    ) {
      valid = false;
    }
  }

  if (!valid) {
    // API vrátí 401 JSON, UI přesměruje na login.
    if (path.startsWith("/api/")) {
      return withCorrelation(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }
    return withCorrelation(NextResponse.redirect(new URL("/login", req.url)));
  }

  // Klouzavá relace: u platného tokenu staršího než práh vydáme čerstvý.
  // Aktivní uživatel tak není odhlášen uprostřed práce; nečinná relace vyprší.
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (payload && typeof payload.iat === "number") {
    const ageSec = Math.floor(Date.now() / 1000) - payload.iat;
    if (ageSec > SESSION_REISSUE_AFTER_SEC) {
      const fresh = await signSessionToken(payload.userId);
      res.cookies.set(SESSION_COOKIE, fresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_TTL_SEC,
        path: "/",
      });
    }
  }
  return withCorrelation(res);
}

// Proxy běží pro všechny routes kromě statických assetů a overlay.js
// (overlay.js se načítá do sandboxovaného iframe bez cookies — musí být veřejný).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|overlay.js).*)"],
};
