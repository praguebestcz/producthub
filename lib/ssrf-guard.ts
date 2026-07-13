import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, request } from "undici";

// SSRF ochrana pro import z URL (závazné podmínky ze security review M1):
//  - jen http(s), jen porty 80/443
//  - zákaz privátních/interních IP rozsahů vč. IPv6 a IPv4-mapped IPv6
//  - DNS PINNING: hostname se resolvuje JEDNOU, všechny adresy se zvalidují
//    a spojení jde přes vlastní lookup, který vrací jen ověřené adresy.
//    Bez pinningu by útočník mohl mezi kontrolou a fetchem přehodit DNS
//    na interní adresu (TOCTOU / DNS rebinding).
//  - redirecty se NEnásledují automaticky — volající je řeší ručně
//    a každý hop znovu validuje.

// Čistá funkce (testovatelná bez sítě): je IP adresa veřejná?
export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPublicIpv4(ip);
  if (family === 6) return isPublicIpv6(ip);
  return false;
}

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 10) return false; // 10/8
  if (a === 127) return false; // loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64/10 (CGNAT)
  if (a === 169 && b === 254) return false; // link-local (cloud metadata!)
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16/12
  if (a === 192 && b === 168) return false; // 192.168/16
  if (a >= 224) return false; // multicast + rezervované
  return true;
}

function isPublicIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4-mapped IPv6 (::ffff:169.254.169.254 — klasický obcházecí trik)
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIpv4(mapped[1]);
  if (lower === "::" || lower === "::1") return false; // unspecified + loopback
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return false; // fe80::/10 link-local
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false; // fc00::/7 ULA
  if (lower.startsWith("ff")) return false; // multicast
  return true;
}

export class SsrfError extends Error {}

// Zvaliduje URL (protokol, port) a resolvuje hostname na ověřené IP adresy.
export async function validateUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("Neplatná URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("Povolené jsou jen http(s) adresy");
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443) {
    throw new SsrfError("Povolené jsou jen porty 80 a 443");
  }
  // Hostname zadaný rovnou jako IP zvaliduj hned.
  if (isIP(url.hostname)) {
    if (!isPublicIp(url.hostname)) {
      throw new SsrfError("Adresa míří do privátní sítě");
    }
  }
  return url;
}

// Fetch s DNS pinningem: undici Agent s vlastním lookupem, který vrací
// POUZE adresy, jež prošly validací. maxRedirections=0 — redirecty řeší volající.
export async function pinnedFetch(
  url: URL,
  opts: { timeoutMs: number; maxBytes: number },
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}> {
  const agent = new Agent({
    connect: {
      timeout: opts.timeoutMs,
      lookup: (hostname, options, callback) => {
        lookup(hostname, { all: true, verbatim: true })
          .then((addresses) => {
            const safe = addresses.filter((a) => isPublicIp(a.address));
            if (safe.length === 0) {
              callback(new SsrfError("Adresa míří do privátní sítě"), []);
              return;
            }
            // undici akceptuje pole {address, family}; typy DNS lookupu
            // tuhle variantu nepopisují přesně, proto přetypování
            callback(null, safe as unknown as Parameters<typeof callback>[1]);
          })
          .catch((e) => callback(e as Error, []));
      },
    },
  });

  try {
    // undici `request` redirecty NEnásleduje (na rozdíl od fetch) — přesně
    // to chceme, každý hop validuje volající ručně.
    const res = await request(url, {
      dispatcher: agent,
      headersTimeout: opts.timeoutMs,
      bodyTimeout: opts.timeoutMs,
      headers: { "user-agent": "ProductHub-import/1.0" },
    });

    // Čtení těla s tvrdým stropem velikosti.
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body) {
      total += (chunk as Buffer).length;
      if (total > opts.maxBytes) {
        res.body.destroy();
        throw new SsrfError("Soubor je větší než povolený limit");
      }
      chunks.push(chunk as Buffer);
    }
    return {
      status: res.statusCode,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: Buffer.concat(chunks),
    };
  } finally {
    await agent.close();
  }
}

// Stáhne URL včetně ručního následování redirectů (každý hop se validuje znovu).
export async function safeDownload(
  rawUrl: string,
  opts: { timeoutMs: number; maxBytes: number; maxRedirects?: number },
): Promise<{ finalUrl: URL; contentType: string; body: Buffer }> {
  let url = await validateUrl(rawUrl);
  const maxRedirects = opts.maxRedirects ?? 3;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await pinnedFetch(url, opts);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers["location"];
      if (!location || typeof location !== "string") {
        throw new SsrfError(`Server vrátil ${res.status} bez cíle přesměrování`);
      }
      url = await validateUrl(new URL(location, url).toString());
      continue;
    }
    if (res.status !== 200) {
      throw new SsrfError(`Server vrátil ${res.status}`);
    }
    const ct = res.headers["content-type"];
    return {
      finalUrl: url,
      contentType: typeof ct === "string" ? ct : "application/octet-stream",
      body: res.body,
    };
  }
  throw new SsrfError("Příliš mnoho přesměrování");
}
