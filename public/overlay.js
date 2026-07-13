/* ProductHub — komentovací vrstva (overlay).
 *
 * Vkládá se do KAŽDÉ servírované HTML stránky (viz lib/html/inject-overlay.ts).
 * Běží v sandboxovaném iframe (opaque origin), takže nemá přístup k cookies
 * ani k rodičovské stránce jinak než přes postMessage.
 *
 * V milníku M5 zatím jen ohlásí rodiči, na které stránce specifikace uživatel je
 * (podle path v URL /view/{token}/{path}). Skutečné komentování přidá M6.
 */
(function () {
  "use strict";

  // Cesta stránky uvnitř balíku = část URL za /view/{token}/.
  function currentPagePath() {
    var m = location.pathname.match(/^\/view\/[^/]+\/(.*)$/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function post(type, extra) {
    var msg = { source: "producthub-overlay", type: type };
    if (extra) for (var k in extra) msg[k] = extra[k];
    // targetOrigin "*" — zpráva nenese žádné tajemství, jen navigační stav.
    try {
      window.parent.postMessage(msg, "*");
    } catch {
      /* rodič nedostupný — ignoruj */
    }
  }

  function ready() {
    post("ready", { pagePath: currentPagePath() });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
