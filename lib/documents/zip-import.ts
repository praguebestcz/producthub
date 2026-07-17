import AdmZip from "adm-zip";
import { LIMITS, isHtmlPath } from "./limits";
import { contentTypeFor } from "@/lib/mime";

// Rozbalí ZIP na seznam souborů pro uložení jako Asset řádky.
// Bezpečnost (security review): ochrana proti zip-slip (cesty s „..", absolutní),
// limity počtu souborů a rozbalené velikosti (zip-bomb).

export type ImportedFile = {
  path: string;
  contentType: string;
  size: number;
  data: Buffer;
};

export type ImportResult = {
  entryPath: string;
  files: ImportedFile[];
};

export class ImportError extends Error {}

// Sanitizace cesty ze ZIPu: normalizace, zákaz úniku z kořene.
// Vrací bezpečnou relativní cestu, nebo null (položku přeskočit/odmítnout).
// Exportováno kvůli přímému testu ochrany proti zip-slip.
export function sanitizeZipPath(raw: string): string | null {
  // Sjednotit oddělovače, useknout případný náběh "./".
  const normalized = raw.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized === "" || normalized.endsWith("/")) return null; // adresář
  if (normalized.startsWith("/")) return null; // absolutní cesta
  // Rozklad na segmenty a kontrola „..".
  const segments = normalized.split("/");
  if (segments.some((s) => s === ".." || s === "")) return null;
  return segments.join("/");
}

// Zvolí vstupní stránku balíku: kořenový index.html, jinak nejmělčí HTML.
function pickEntryPath(paths: string[]): string {
  const htmls = paths.filter(isHtmlPath);
  if (htmls.length === 0) {
    throw new ImportError("Balíček neobsahuje žádnou HTML stránku");
  }
  const rootIndex = htmls.find((p) => p.toLowerCase() === "index.html");
  if (rootIndex) return rootIndex;
  // Nejmělčí (nejméně lomítek), pak abecedně — stabilní volba.
  return htmls.sort((a, b) => {
    const da = a.split("/").length;
    const db = b.split("/").length;
    return da !== db ? da - db : a.localeCompare(b);
  })[0];
}

export function importZip(buffer: Buffer): ImportResult {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ImportError("Soubor není platný ZIP");
  }

  const entries = zip.getEntries();
  if (entries.length > LIMITS.maxZipEntries) {
    throw new ImportError(
      `ZIP má příliš mnoho souborů (max ${LIMITS.maxZipEntries})`,
    );
  }

  const files: ImportedFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const path = sanitizeZipPath(entry.entryName);
    if (!path) continue; // nebezpečná/prázdná cesta — přeskočit
    if (seen.has(path)) continue; // duplicita (unikát v DB stejně)
    seen.add(path);

    // Kontrola PŘED dekompresí (obrana proti zip-bombě, security review):
    // deklarovaná rozbalená velikost z hlavičky ZIP. Deflate má poměr až
    // ~1000:1, takže malý ZIP by se bez této kontroly rozbalil na desítky GB
    // do paměti (OOM) ještě než by se limit vyhodnotil po getData().
    const declaredSize = entry.header.size;
    if (declaredSize > LIMITS.maxFileBytes) {
      throw new ImportError(`Soubor „${path}" je větší než 5 MB`);
    }
    if (totalBytes + declaredSize > LIMITS.maxZipUncompressedBytes) {
      throw new ImportError(
        `Rozbalený obsah je větší než ${LIMITS.maxZipUncompressedBytes / 1024 / 1024} MB`,
      );
    }

    const data = entry.getData(); // rozbalí do paměti (velikost už ověřena výše)
    totalBytes += data.length;
    // Pojistka i po dekompresi (kdyby hlavička lhala o velikosti).
    if (
      totalBytes > LIMITS.maxZipUncompressedBytes ||
      data.length > LIMITS.maxFileBytes
    ) {
      throw new ImportError("Rozbalený obsah překročil povolenou velikost");
    }

    files.push({
      path,
      contentType: contentTypeFor(path),
      size: data.length,
      data,
    });
  }

  if (files.length === 0) {
    throw new ImportError("ZIP je prázdný nebo neobsahuje použitelné soubory");
  }

  return { entryPath: pickEntryPath(files.map((f) => f.path)), files };
}
