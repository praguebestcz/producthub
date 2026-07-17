// Pomocníci pro čtení HTTP těla s tvrdým stropem velikosti.
//
// Security review (2026-07-17): kontrola hlavičky `content-length` NEstačí —
// chunked přenos hlavičku nemá, takže `Number(content-length ?? 0)` vyjde 0,
// projde a `req.json()` pak načte neomezené tělo do paměti (App Router nemá
// výchozí limit těla). Proto tělo čteme streamem a nad stropem přerušíme.

export class BodyTooLargeError extends Error {
  constructor() {
    super("Tělo požadavku je příliš velké");
  }
}

// Přečte celé tělo requestu, ale přeruší, jakmile překročí `maxBytes`.
// Vrací syrový string; nad limitem hodí BodyTooLargeError.
export async function readBodyText(
  req: Request,
  maxBytes: number,
): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Přečte tělo se stropem a naparsuje JSON. Nad limitem hodí BodyTooLargeError;
// při neplatném JSON vrací null (volající pošle 400 přes Zod).
export async function readJsonLimited(
  req: Request,
  maxBytes: number,
): Promise<unknown> {
  const text = await readBodyText(req, maxBytes);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
