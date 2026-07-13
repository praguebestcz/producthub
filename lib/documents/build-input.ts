import { z } from "zod";
import type { DocumentSource } from "@prisma/client";
import { LIMITS } from "./limits";
import { contentTypeFor } from "@/lib/mime";
import { importZip, ImportError, type ImportResult } from "./zip-import";
import { importFromUrl } from "./url-import";

// Sjednocené zpracování vstupu pro nový dokument / verzi:
//  - multipart soubor .html/.htm  → jediný Asset "index.html"
//  - multipart soubor .zip        → rozbalený balík
//  - JSON { url }                 → import z URL (crawl)
// Vrací zdroj + výsledek importu. Chyby jako ImportError (čitelná hláška).

export const urlImportSchema = z.object({
  url: z.string().url("Zadejte platnou URL").max(2000),
});

function singleHtml(name: string, data: Buffer): ImportResult {
  return {
    entryPath: "index.html",
    files: [
      {
        path: "index.html",
        contentType: "text/html; charset=utf-8",
        size: data.length,
        data,
      },
    ],
  };
}

export type PreparedImport = {
  source: DocumentSource;
  sourceUrl: string | null;
  result: ImportResult;
  // Návrh názvu dokumentu (z názvu souboru / hostitele URL).
  suggestedName: string;
};

// Zpracuje multipart soubor.
export async function prepareFromFile(file: File): Promise<PreparedImport> {
  if (file.size > LIMITS.maxZipUncompressedBytes) {
    throw new ImportError("Soubor je příliš velký");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip")) {
    const result = importZip(buffer);
    return {
      source: "UPLOAD",
      sourceUrl: null,
      result,
      suggestedName: file.name.replace(/\.zip$/i, ""),
    };
  }
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    if (buffer.length > LIMITS.maxFileBytes) {
      throw new ImportError("HTML soubor je větší než 5 MB");
    }
    return {
      source: "UPLOAD",
      sourceUrl: null,
      result: singleHtml(file.name, buffer),
      suggestedName: file.name.replace(/\.html?$/i, ""),
    };
  }
  throw new ImportError("Podporované jsou soubory .html nebo .zip");
}

// Zpracuje import z URL.
export async function prepareFromUrl(url: string): Promise<PreparedImport> {
  const result = await importFromUrl(url);
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    /* ponech původní */
  }
  return { source: "URL", sourceUrl: url, result, suggestedName: host };
}

// Jen pro typovou kontrolu contentType u jednotlivých souborů (využívá mime).
export { contentTypeFor };
