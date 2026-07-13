// Jednoduchý rate-limit v paměti (Railway = jeden proces, stejně jako SSE hub).
// Posuvné okno: max `limit` akcí za `windowMs` na klíč (typicky userId + akce).
// Po expert review: importy z URL jsou drahé a SSRF-citlivé — limit už od M5.

const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
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
