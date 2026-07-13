// Vloží komentovací vrstvu (/overlay.js) do každé servírované HTML stránky.
// Vkládá se před </body>; když dokument </body> nemá (fragmenty, chybné HTML),
// skript se přidá na konec — prohlížeč si poradí.

const OVERLAY_TAG = '<script src="/overlay.js" defer></script>';

export function injectOverlay(html: string): string {
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + OVERLAY_TAG;
  return html.slice(0, idx) + OVERLAY_TAG + html.slice(idx);
}
