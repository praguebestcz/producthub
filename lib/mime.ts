// Mapa přípona → Content-Type pro servírování uložených assetů.
// Vědomě malá — pokrývá, co se reálně vyskytuje v HTML specifikacích.
const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

export function contentTypeFor(path: string): string {
  // Odstranit query/fragment (logo.png?v=1) — jinak by přípona byla „png?v=1".
  const clean = path.split(/[?#]/)[0];
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

export function isHtmlContentType(contentType: string): boolean {
  return contentType.startsWith("text/html");
}
