import { parse as parseHtml } from "node-html-parser";
import { LIMITS, isHtmlPath } from "./limits";
import { safeDownload, SsrfError } from "@/lib/ssrf-guard";
import { contentTypeFor, isHtmlContentType } from "@/lib/mime";
import type { ImportResult, ImportedFile } from "./zip-import";
import { ImportError } from "./zip-import";

// Import specifikace z URL: stáhne vstupní stránku, projde odkazy a assety
// na STEJNÉ doméně (HTML stránky do hloubky 2, assety), vše uloží jako snapshot.
// Odkazy na cizí domény (Google Fonts, CDN…) zůstávají živé.
//
// Bezpečnost: veškeré stahování jde přes safeDownload (SSRF guard s DNS pinningem,
// jen http/https, jen porty 80/443, zákaz privátních IP). Limity z LIMITS.

// URL → klíč pro uložení (cesta + query). "/" → "index.html", koncové "/" →
// "…/index.html". Query se ZAHRNUJE do klíče — jinak by dva assety lišící se
// jen query (logo.png?v=1 vs ?v=2) kolidovaly a druhý by se ztratil (code review).
function urlToPath(u: URL): string {
  let p = u.pathname;
  if (p === "" || p === "/") p = "index.html";
  else {
    if (p.startsWith("/")) p = p.slice(1);
    if (p.endsWith("/")) p += "index.html";
  }
  return p + u.search;
}

// Je odkaz pravděpodobně HTML STRÁNKA (kandidát na crawl a komentování)?
// Kromě .html/.htm i clean URL bez přípony (typické pro Vercel/Next.js specs:
// /frontend, /wireframy) — poslední segment cesty nemá tečku (= není asset).
function isLikelyPage(u: URL): boolean {
  const last = u.pathname.split("/").pop() ?? "";
  return isHtmlPath(u.pathname) || last === "" || last.includes(".") === false;
}

// Vytáhne z HTML odkazy na stránky (a[href]) a assety (link/script/img).
function extractLinks(
  html: string,
  pageUrl: URL,
  origin: string,
): { pages: URL[]; assets: URL[] } {
  const root = parseHtml(html);
  const pages: URL[] = [];
  const assets: URL[] = [];

  const resolve = (val: string | undefined): URL | null => {
    if (!val) return null;
    const trimmed = val.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:") ||
      trimmed.startsWith("javascript:") ||
      trimmed.startsWith("data:")
    ) {
      return null;
    }
    try {
      const abs = new URL(trimmed, pageUrl);
      abs.hash = "";
      return abs.origin === origin ? abs : null; // jen stejná doména
    } catch {
      return null;
    }
  };

  for (const a of root.querySelectorAll("a[href]")) {
    const u = resolve(a.getAttribute("href"));
    if (u && isLikelyPage(u)) pages.push(u);
  }
  for (const sel of ["link[href]", "script[src]", "img[src]"]) {
    for (const el of root.querySelectorAll(sel)) {
      const u = resolve(el.getAttribute("href") ?? el.getAttribute("src"));
      if (u) assets.push(u);
    }
    // srcset (obrázky)
  }
  for (const img of root.querySelectorAll("img[srcset]")) {
    const srcset = img.getAttribute("srcset") ?? "";
    for (const part of srcset.split(",")) {
      const u = resolve(part.trim().split(/\s+/)[0]);
      if (u) assets.push(u);
    }
  }

  return { pages, assets };
}

// Odkazy, které stránka načítá až JavaScriptem za běhu — `fetch('spec.md')`,
// `fetch("data.json")` apod. Statický parser HTML je nevidí, proto zvlášť
// regexem prohledáme zdroj HTML stránky (vč. inline <script>). PB specifikace
// takhle načítají markdown obsah (funkční spec, popis komponent).
// Známé omezení: fetch() uvnitř EXTERNÍCH .js souborů se nenajde (ty se jen
// stáhnou jako assety). Pro PB specifikace stačí — fetch je vždy inline.
// Exportováno kvůli testu.
export function extractFetchUrls(
  source: string,
  pageUrl: URL,
  origin: string,
): URL[] {
  const out: URL[] = [];
  const re = /fetch\(\s*['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const raw = m[1].trim();
    if (raw === "" || raw.startsWith("http") === false && raw.includes("${")) {
      continue; // šablonový řetězec — neumíme vyhodnotit
    }
    try {
      const abs = new URL(raw, pageUrl);
      abs.hash = "";
      if (abs.origin === origin) out.push(abs);
    } catch {
      /* neplatná URL — přeskoč */
    }
  }
  return out;
}

export async function importFromUrl(rawUrl: string): Promise<ImportResult> {
  let entry: URL;
  try {
    entry = new URL(rawUrl);
  } catch {
    throw new ImportError("Neplatná URL");
  }
  const origin = entry.origin;

  const files = new Map<string, ImportedFile>();
  let totalBytes = 0;

  const addFile = (path: string, contentType: string, data: Buffer) => {
    if (files.has(path)) return;
    totalBytes += data.length;
    if (totalBytes > LIMITS.maxSnapshotBytes) {
      throw new ImportError(
        `Snapshot je větší než ${LIMITS.maxSnapshotBytes / 1024 / 1024} MB`,
      );
    }
    files.set(path, { path, contentType, size: data.length, data });
  };

  const download = (u: URL) =>
    safeDownload(u.toString(), {
      timeoutMs: LIMITS.fetchTimeoutMs,
      maxBytes: LIMITS.maxFileBytes,
    });

  // BFS přes HTML stránky do hloubky maxCrawlDepth; assety sbíráme cestou.
  const visitedPages = new Set<string>();
  const assetUrls = new Set<string>();
  const queue: { url: URL; depth: number }[] = [{ url: entry, depth: 0 }];
  const entryPath = urlToPath(entry);

  try {
    while (queue.length > 0 && visitedPages.size < LIMITS.maxCrawlPages) {
      const { url, depth } = queue.shift()!;
      const path = urlToPath(url);
      if (visitedPages.has(path)) continue;
      visitedPages.add(path);

      const res = await download(url);
      const ct = isHtmlContentType(res.contentType)
        ? "text/html; charset=utf-8"
        : res.contentType || contentTypeFor(path);
      addFile(path, ct, res.body);

      if (isHtmlContentType(res.contentType)) {
        const source = res.body.toString("utf-8");
        const { pages, assets } = extractLinks(source, url, origin);
        for (const a of assets) assetUrls.add(a.toString());
        // Odkazy načítané za běhu přes fetch() (např. spec.md).
        for (const f of extractFetchUrls(source, url, origin)) {
          assetUrls.add(f.toString());
        }
        if (depth < LIMITS.maxCrawlDepth) {
          for (const p of pages) {
            if (!visitedPages.has(urlToPath(p))) {
              queue.push({ url: p, depth: depth + 1 });
            }
          }
        }
      }
    }

    // Stáhnout nasbírané assety (stejná doména). Po expert review: strop na
    // počet + contentType z přípony (ne z odpovědi cizího serveru).
    let assetCount = 0;
    for (const raw of assetUrls) {
      if (assetCount >= LIMITS.maxAssets) break;
      const u = new URL(raw);
      const path = urlToPath(u);
      if (files.has(path)) continue;
      assetCount++;
      try {
        const res = await download(u);
        addFile(path, contentTypeFor(path), res.body);
      } catch (e) {
        if (e instanceof ImportError) throw e; // limit velikosti = tvrdá chyba
        // Nedostupný asset (404, timeout) přeskočíme — nesmí shodit celý import.
      }
    }
  } catch (e) {
    if (e instanceof SsrfError) throw new ImportError(e.message);
    throw e;
  }

  if (!files.has(entryPath)) {
    throw new ImportError("Vstupní stránku se nepodařilo stáhnout");
  }

  return { entryPath, files: [...files.values()] };
}
