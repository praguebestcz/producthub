// Jednoduchý rate-limit v paměti (Railway = jeden proces, stejně jako SSE hub).
// Posuvné okno: max `limit` akcí za `windowMs` na klíč (typicky userId + akce).
// Po expert review: importy z URL jsou drahé a SSRF-citlivé — limit už od M5.

const buckets = new Map<string, number[]>();

// Po security review: mapa `buckets` se dřív nikdy nečistila (klíče zůstávaly
// navždy = pomalý únik paměti v dlouho běžícím procesu). Občas (každých N
// volání) projdeme a smažeme neaktivní klíče. TTL 1 h pokrývá i nejdelší okno
// (import 60 min); klíč bez aktivity déle je mrtvý.
const CLEANUP_EVERY = 500;
const IDLE_TTL_MS = 60 * 60 * 1000;
let opsSinceCleanup = 0;

function cleanup(now: number): void {
  for (const [key, ts] of buckets) {
    const last = ts.length ? ts[ts.length - 1] : 0;
    if (last < now - IDLE_TTL_MS) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (++opsSinceCleanup >= CLEANUP_EVERY) {
    opsSinceCleanup = 0;
    cleanup(now);
  }
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    const oldest = Math.min(...timestamps);
    return {
      ok: false,
      retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { ok: true, retryAfterSec: 0 };
}
