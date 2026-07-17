import { NextRequest, NextResponse } from "next/server";
import { verifyViewToken } from "@/lib/jwt";
import { requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHtmlContentType } from "@/lib/mime";
import { injectOverlay } from "@/lib/html/inject-overlay";

// Servíruje uložené soubory verze dokumentu do sandboxovaného iframe.
// Cesta: /view/{token}/{path…}. Token je krátkodobý jose JWT (typ "view"),
// NE cookie — iframe běží v opaque originu (sandbox bez allow-same-origin),
// takže cookies stejně neposílá.
//
// Bezpečnost (závazné podmínky ze security review):
//  - ověření podpisu tokenu + typu "view"
//  - RE-CHECK členství v projektu (ne jen při vydání tokenu)
//  - kontrola tokenValidFrom + deactivatedAt (deaktivace/odhlášení zabíjí i view)
//  - HTML se servíruje s CSP `sandbox allow-scripts` a `Referrer-Policy: no-referrer`
//  - do HTML se injektuje overlay.js (komentovací vrstva)

// Bezpečné hlavičky pro každou view odpověď.
// `cacheable` = neměnný asset verze (CSS/JS/obrázek/font) — smí se cacheovat,
// verze je snapshot a obsah se nikdy nezmění (výkon: nečíst bytea z DB při
// každé navigaci). HTML NEcacheovat (injektuje se overlay, stav se může měnit).
function viewHeaders(contentType: string, cacheable = false): Headers {
  const h = new Headers();
  h.set("Content-Type", contentType);
  h.set("X-Content-Type-Options", "nosniff");
  // Token je v URL — nesmí utéct přes Referer na cizí domény odkazované z prototypu.
  h.set("Referrer-Policy", "no-referrer");
  // I při přímém otevření URL běží obsah v sandboxu (bez same-originu).
  h.set("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-popups");
  // Sandbox = opaque origin. Aby stránka směla načíst svoje sourozenecké soubory
  // přes fetch() (např. spec.md), musí view odpověď povolit cross-origin čtení.
  // Bezpečné: bránou je token v URL (kdo ho nemá, nenačte nic), ne origin.
  h.set("Access-Control-Allow-Origin", "*");
  // max-age ~ životnost view-tokenu (1 h); po expiraci se stejně vydá nový token.
  h.set(
    "Cache-Control",
    cacheable ? "private, max-age=3600, immutable" : "private, no-store",
  );
  return h;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; path?: string[] }> },
) {
  const { token, path } = await params;

  const payload = await verifyViewToken(token);
  if (!payload) {
    return new NextResponse("Neplatný nebo prošlý odkaz", { status: 403 });
  }

  // Verze a re-check uživatele jsou nezávislé — paralelně (šetří round-trip).
  const [version, user] = await Promise.all([
    prisma.documentVersion.findUnique({
      where: { id: payload.versionId },
      select: {
        id: true,
        entryPath: true,
        document: { select: { projectId: true } },
      },
    }),
    // Re-check: uživatel pořád existuje, není deaktivovaný, token je čerstvý.
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { deactivatedAt: true, tokenValidFrom: true },
    }),
  ]);
  if (!version) return new NextResponse("Nenalezeno", { status: 404 });
  if (
    !user ||
    user.deactivatedAt ||
    payload.iat < Math.floor(user.tokenValidFrom.getTime() / 1000)
  ) {
    return new NextResponse("Přístup zamítnut", { status: 403 });
  }
  // Re-check: pořád je členem projektu.
  const member = await requireProjectRole(
    payload.userId,
    version.document.projectId,
    "READER",
  );
  if (!member) return new NextResponse("Přístup zamítnut", { status: 403 });

  // Prázdná cesta → přesměruj na vstupní stránku (zachová prefix tokenu).
  // Query se zahrnuje do klíče (assety uložené s query — logo.png?v=1).
  const relPath = (path ?? []).join("/") + req.nextUrl.search;
  if (relPath === "") {
    return NextResponse.redirect(
      new URL(`/view/${token}/${version.entryPath}`, req.url),
    );
  }

  const asset = await prisma.asset.findUnique({
    where: {
      documentVersionId_path: { documentVersionId: version.id, path: relPath },
    },
  });
  if (!asset) return new NextResponse("Soubor nenalezen", { status: 404 });

  // HTML: injektuj overlay a servíruj jako text; ostatní binárně.
  if (isHtmlContentType(asset.contentType)) {
    const html = injectOverlay(Buffer.from(asset.data).toString("utf-8"));
    return new NextResponse(html, {
      headers: viewHeaders("text/html; charset=utf-8"),
    });
  }

  return new NextResponse(Buffer.from(asset.data), {
    headers: viewHeaders(asset.contentType, true),
  });
}
