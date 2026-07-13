// Limity pro nahrávání a import dokumentů (závazné podmínky ze security review).
// Sdílené mezi ZIP importem, URL importem i API vrstvou.

export const LIMITS = {
  // Jeden nahraný HTML soubor / jednotlivý asset.
  maxFileBytes: 5 * 1024 * 1024, // 5 MB
  // ZIP: rozbalená velikost a počet souborů (ochrana proti zip-bomb).
  maxZipUncompressedBytes: 20 * 1024 * 1024, // 20 MB
  maxZipEntries: 500,
  // URL crawl: kolik stránek a celková velikost snapshotu.
  maxCrawlPages: 30,
  maxCrawlDepth: 2,
  // Po expert review: strop na počet stahovaných assetů (0 B assety by jinak
  // limit velikosti obešly a mohly zahltit server/třetí stranu).
  maxAssets: 200,
  maxSnapshotBytes: 25 * 1024 * 1024, // 25 MB
  // Timeout jednoho síťového požadavku při importu z URL.
  fetchTimeoutMs: 15_000,
} as const;

// Přípony považované za HTML stránku (kandidát na komentování + crawl).
export function isHtmlPath(path: string): boolean {
  const p = path.toLowerCase();
  return p.endsWith(".html") || p.endsWith(".htm");
}
