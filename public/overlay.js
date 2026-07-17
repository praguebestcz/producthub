/* ProductHub — komentovací vrstva (overlay).
 *
 * Vkládá se do KAŽDÉ servírované HTML stránky (viz lib/html/inject-overlay.ts).
 * Běží v sandboxovaném iframe (opaque origin) — s rodičem mluví VÝHRADNĚ přes
 * postMessage. Čistý JS bez build kroku.
 *
 * Protokol iframe → parent (source: "producthub-overlay"):
 *   ready            {pagePath}                — při každém načtení stránky
 *   element.selected {pagePath, dataReviewId, domPath, rect, elementHtml, viewport}
 *   pin.clicked      {commentId}
 * Protokol parent → iframe (source: "producthub-parent"):
 *   mode       {commenting: boolean}
 *   pins.update{pins: [{commentId, dataReviewId, domPath, status}]}
 *   highlight  {commentId}
 */
(function () {
  "use strict";

  var MAX_ELEMENT_HTML = 20000; // musí odpovídat Zod limitu elementHtml

  // ---- stav overlaye -------------------------------------------------------
  var commenting = false; // režim komentování (crosshair, klik = výběr)
  var pins = []; // poslední pins.update od rodiče
  // Po kliknutí je element „vybraný": hover se ZASTAVÍ a výběr zůstane
  // orámovaný, dokud rodič nepošle selection.clear (uložení/zrušení formuláře).
  // Bez toho rámeček skákal po stránce cestou myši k panelu (zpětná vazba Hany).
  var selectionActive = false;
  var selectedEl = null; // vybraný prvek — rodič u něj drží bublinu komentáře

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

  // ---- vlastní prvky overlaye (ignorované při výběru i MutationObserveru) --
  // Všechny nesou data-ph-overlay, ať je pozná computeDomPath i click handler.

  var styleEl = document.createElement("style");
  styleEl.setAttribute("data-ph-overlay", "");
  styleEl.textContent = [
    "html.ph-commenting, html.ph-commenting * { cursor: crosshair !important; }",
    ".ph-hover-box { position: absolute; pointer-events: none; z-index: 2147483645;",
    "  border: 2px solid #c8102e; background: rgba(200,16,46,.08); border-radius: 2px; }",
    ".ph-sel-box { position: absolute; pointer-events: none; z-index: 2147483645;",
    "  border: 2px solid #c8102e; outline: 2px solid rgba(200,16,46,.25); outline-offset: 2px; border-radius: 2px; }",
    ".ph-pin { position: absolute; z-index: 2147483646; width: 26px; height: 26px;",
    "  border-radius: 50% 50% 50% 0; transform: rotate(-45deg);",
    "  border: 1px solid #c8102e; background: #c8102e; cursor: pointer;",
    "  box-shadow: 0 1px 3px rgba(0,0,0,.25); padding: 0; }",
    ".ph-pin[data-status=RESOLVED] { border-color: #16a34a; background: #16a34a; }",
    // Vnitřek narovnaný zpět (+45°): avatar autora nebo iniciála. Tenký lem
    // (barva stavu prosvítá jen mírně), ať orámování není tučné (přání Hany).
    ".ph-pin-inner { position: absolute; inset: 1px; border-radius: 50%;",
    "  overflow: hidden; transform: rotate(45deg); background: #fff;",
    "  display: flex; align-items: center; justify-content: center; }",
    ".ph-pin-initial { font: 700 12px/1 sans-serif; color: #c8102e; text-transform: uppercase; }",
    ".ph-pin[data-status=RESOLVED] .ph-pin-initial { color: #16a34a; }",
    ".ph-pin-avatar { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }",
    // Pořadové číslo jako malý badge (párování se seznamem v panelu).
    ".ph-pin-num { position: absolute; top: -7px; right: -7px; transform: rotate(45deg);",
    "  min-width: 15px; height: 15px; box-sizing: border-box; padding: 0 3px;",
    "  border-radius: 999px; background: #111827; color: #fff; border: 1.5px solid #fff;",
    "  font: 700 9px/12px sans-serif; text-align: center; }",
    ".ph-pin[data-hidden] { display: none; }",
    ".ph-highlight { animation: ph-pulse 0.65s ease-in-out 0s 3 !important;",
    "  outline: 3px solid #c8102e !important; outline-offset: 2px; border-radius: 2px; }",
    "@keyframes ph-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(200,16,46,.0); }",
    "  50% { box-shadow: 0 0 0 6px rgba(200,16,46,.35); } }",
  ].join("\n");

  var hoverBox = document.createElement("div");
  hoverBox.className = "ph-hover-box";
  hoverBox.setAttribute("data-ph-overlay", "");
  hoverBox.style.display = "none";

  // Rámeček VYBRANÉHO elementu — drží se, dokud je otevřený formulář komentáře.
  var selBox = document.createElement("div");
  selBox.className = "ph-sel-box";
  selBox.setAttribute("data-ph-overlay", "");
  selBox.style.display = "none";

  var pinLayer = document.createElement("div");
  pinLayer.setAttribute("data-ph-overlay", "");
  // Vrstva bez rozměrů — špendlíky jsou pozicované absolutně vůči dokumentu.
  pinLayer.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;";

  function mountOwnElements() {
    (document.head || document.documentElement).appendChild(styleEl);
    document.body.appendChild(hoverBox);
    document.body.appendChild(selBox);
    document.body.appendChild(pinLayer);
  }

  function placeBox(box, rect) {
    box.style.display = "block";
    box.style.top = rect.top + "px";
    box.style.left = rect.left + "px";
    box.style.width = rect.width + "px";
    box.style.height = rect.height + "px";
  }

  function clearSelection() {
    selectionActive = false;
    selectedEl = null;
    selBox.style.display = "none";
  }

  // Při scrollu/resize drž rámeček výběru u prvku a hlas rodiči novou pozici,
  // ať u prvku zůstane i bublina komentáře.
  function reportSelectionMove() {
    if (!selectionActive || !selectedEl) return;
    placeBox(selBox, documentRect(selectedEl));
    post("anchor.moved", { viewportRect: viewportRect(selectedEl) });
  }

  function isOwn(el) {
    return !!(el && el.closest && el.closest("[data-ph-overlay]"));
  }

  // ---- kotva elementu ------------------------------------------------------

  // CSS cesta od elementu nahoru: stop na nejbližším #id (CSS.escape),
  // jinak tag:nth-of-type(n); spojeno " > ". Vyhodnotitelné querySelectorem.
  function computeDomPath(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (node.id) {
        parts.unshift("#" + CSS.escape(node.id));
        return parts.join(" > ");
      }
      var tag = node.tagName.toLowerCase();
      var index = 1;
      var sib = node.previousElementSibling;
      while (sib) {
        if (sib.tagName === node.tagName) index++;
        sib = sib.previousElementSibling;
      }
      parts.unshift(tag + ":nth-of-type(" + index + ")");
      node = node.parentElement;
    }
    parts.unshift("html");
    return parts.join(" > ");
  }

  // Čitelný popis prvku pro panel (uživatele nezajímá DOM cesta).
  // Např. „tlačítko „Odeslat dotaz"" nebo „nadpis „Dotazy"".
  var TAG_NAMES = {
    A: "odkaz",
    BUTTON: "tlačítko",
    INPUT: "pole",
    TEXTAREA: "pole",
    SELECT: "výběr",
    IMG: "obrázek",
    H1: "nadpis",
    H2: "nadpis",
    H3: "nadpis",
    H4: "nadpis",
    P: "odstavec",
    LI: "položka",
    TD: "buňka",
    TH: "buňka",
    LABEL: "popisek",
    SPAN: "text",
    DIV: "blok",
    SECTION: "sekce",
    NAV: "navigace",
    UL: "seznam",
    OL: "seznam",
    FORM: "formulář",
  };
  function elementLabel(el) {
    var name = TAG_NAMES[el.tagName] || el.tagName.toLowerCase();
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 40) text = text.slice(0, 40) + "…";
    return text ? name + " „" + text + "“" : name;
  }

  // Rect elementu v DOKUMENTOVÝCH souřadnicích (ne viewport).
  function documentRect(el) {
    var r = el.getBoundingClientRect();
    return {
      top: r.top + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
      height: r.height,
    };
  }

  // Rect ve VIEWPORT souřadnicích (bez scrollu) — iframe vyplňuje kontejner
  // v rodiči, takže tyto souřadnice = pozice prvku v prohlížeči. Rodič podle
  // nich umístí bublinu komentáře přímo u prvku.
  function viewportRect(el) {
    var r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.bottom,
      right: r.right,
    };
  }

  // Najdi element podle kotvy: přednostně data-review-id, jinak domPath.
  function resolveAnchor(pin) {
    try {
      if (pin.dataReviewId) {
        var byId = document.querySelector(
          '[data-review-id="' + CSS.escape(pin.dataReviewId) + '"]',
        );
        if (byId) return byId;
      }
      if (pin.domPath) return document.querySelector(pin.domPath);
    } catch {
      /* neplatný selektor (např. z jiné verze stránky) — špendlík se schová */
    }
    return null;
  }

  function isElementVisible(el) {
    if (typeof el.checkVisibility === "function") return el.checkVisibility();
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ---- špendlíky -----------------------------------------------------------

  function renderPins() {
    pinLayer.textContent = "";
    for (var i = 0; i < pins.length; i++) {
      var pin = pins[i];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ph-pin";
      btn.setAttribute("data-ph-overlay", "");
      btn.setAttribute("data-comment-id", String(pin.commentId));
      btn.setAttribute("data-status", pin.status || "OPEN");
      btn.setAttribute("aria-label", "Komentář " + (i + 1));
      // Náhled komentáře na najetí myší (nativní tooltip).
      if (pin.preview) btn.title = pin.preview;
      // Vnitřek: iniciála autora (vždy) + avatar přes ni (když je a načte se).
      var inner = document.createElement("span");
      inner.className = "ph-pin-inner";
      var initial = document.createElement("span");
      initial.className = "ph-pin-initial";
      initial.textContent = (pin.authorName || "?").trim().charAt(0) || "?";
      inner.appendChild(initial);
      if (pin.avatarUrl) {
        var img = document.createElement("img");
        img.className = "ph-pin-avatar";
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        // Když se avatar nenačte, schová se a prosvítá iniciála.
        img.onerror = function () {
          this.style.display = "none";
        };
        img.src = pin.avatarUrl;
        inner.appendChild(img);
      }
      btn.appendChild(inner);
      var num = document.createElement("span");
      num.className = "ph-pin-num";
      num.textContent = String(i + 1);
      btn.appendChild(num);
      // Klik na špendlík funguje v OBOU režimech (capture click ho propustí).
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        post("pin.clicked", {
          commentId: Number(this.getAttribute("data-comment-id")),
        });
      });
      pinLayer.appendChild(btn);
    }
    repositionAll();
  }

  // Je prvek překrytý něčím nad ním (např. otevřeným modalem)? Pak jeho
  // špendlík nemá „prosvítat" přes modal — schová se. Kontrola přes elementy
  // v bodě středu prvku (vlastní overlay prvky se ignorují).
  function isCoveredByOther(el, rect) {
    var cx = rect.left - window.scrollX + rect.width / 2;
    var cy = rect.top - window.scrollY + rect.height / 2;
    // Střed mimo viewport → neřešíme tady (řeší isElementVisible/scroll).
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
      return false;
    }
    var stack = document.elementsFromPoint(cx, cy);
    for (var i = 0; i < stack.length; i++) {
      var e = stack[i];
      // Přeskoč vlastní vrstvy overlaye (špendlíky, rámečky).
      if (e.closest && e.closest("[data-ph-overlay]")) continue;
      // První „cizí" prvek odshora: pokud to je náš prvek (nebo příbuzný),
      // je navrchu = vidět. Jinak ho něco překrývá (modal) → schovat špendlík.
      return !(e === el || el.contains(e) || e.contains(el));
    }
    return false;
  }

  function repositionAll() {
    var buttons = pinLayer.children;
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var pin = pins[i];
      if (!pin) continue;
      var el = resolveAnchor(pin);
      // Nenalezený nebo skrytý element (zavřený modal) → špendlík se schová.
      if (!el || !isElementVisible(el)) {
        btn.setAttribute("data-hidden", "");
        continue;
      }
      var rect = documentRect(el);
      if (rect.width === 0 && rect.height === 0) {
        btn.setAttribute("data-hidden", "");
        continue;
      }
      // Prvek překrytý modalem → špendlík se schová (nemá prosvítat přes modal).
      if (isCoveredByOther(el, rect)) {
        btn.setAttribute("data-hidden", "");
        continue;
      }
      btn.removeAttribute("data-hidden");
      // Špendlík k pravému hornímu rohu elementu; u prvků přes celou šířku by
      // ale přetekl za pravý okraj a ořízl se, tak ho podržíme uvnitř stránky.
      var docWidth =
        document.documentElement.scrollWidth || document.documentElement.clientWidth;
      var left = rect.left + rect.width - 10;
      if (left > docWidth - 28) left = docWidth - 28;
      if (left < 2) left = 2;
      btn.style.top = rect.top - 10 + "px";
      btn.style.left = left + "px";
    }
  }

  // Debounced reposition — JS prototypu mění DOM za běhu (modaly, dynamická
  // tlačítka), špendlíky se musí srovnat po ustálení.
  var repositionTimer = null;
  function scheduleReposition() {
    if (repositionTimer) clearTimeout(repositionTimer);
    repositionTimer = setTimeout(function () {
      repositionTimer = null;
      repositionAll();
    }, 150);
  }

  // ---- režim komentování ---------------------------------------------------

  function setCommenting(on) {
    commenting = !!on;
    document.documentElement.classList.toggle("ph-commenting", commenting);
    if (!commenting) {
      hoverBox.style.display = "none";
      clearSelection();
    }
  }

  // Celostránkové kontejnery nedávají jako kotva smysl a jejich rámeček
  // vypadá jako „označila se celá stránka" — přeskakují se.
  function isPageContainer(el) {
    return el === document.body || el === document.documentElement;
  }

  function onMouseOver(e) {
    // Během aktivního výběru hover NEjezdí — vybraný element zůstává orámovaný.
    if (!commenting || selectionActive) return;
    var target = e.target;
    if (!(target instanceof Element) || isOwn(target)) return;
    if (isPageContainer(target)) {
      hoverBox.style.display = "none";
      return;
    }
    placeBox(hoverBox, documentRect(target));
  }

  // Myš opustila stránku (např. cestou k panelu komentářů) → rámeček zmizí.
  function onMouseOut(e) {
    if (!e.relatedTarget) hoverBox.style.display = "none";
  }

  function onClickCapture(e) {
    if (!commenting) return;
    var target = e.target;
    if (!(target instanceof Element)) return;
    // Kliky na vlastní prvky (špendlíky) řeší jejich vlastní handler.
    if (isOwn(target)) return;
    // Výběr elementu — stránka nesmí reagovat (modal se nesmí otevřít).
    e.preventDefault();
    e.stopPropagation();
    // Klik do prázdna (body/html) nevybírá „celou stránku" — zavře bublinu.
    if (isPageContainer(target)) {
      clearSelection();
      post("background.clicked");
      return;
    }

    // Přednostní kotva: nejbližší [data-review-id] (pravidlo PB specifikací).
    var reviewEl = target.closest("[data-review-id]");
    var anchorEl = reviewEl || target;
    var html = anchorEl.outerHTML || "";

    // Výběr zůstane orámovaný, dokud rodič nepošle selection.clear.
    selectionActive = true;
    selectedEl = anchorEl;
    hoverBox.style.display = "none";
    placeBox(selBox, documentRect(anchorEl));
    post("element.selected", {
      pagePath: currentPagePath(),
      dataReviewId: reviewEl
        ? reviewEl.getAttribute("data-review-id")
        : null,
      // domPath se počítá VŽDY (fallback kotva pro přenos mezi verzemi).
      domPath: computeDomPath(anchorEl),
      label: elementLabel(anchorEl),
      rect: documentRect(anchorEl),
      // viewportRect = pozice v prohlížeči → bublina komentáře u prvku.
      viewportRect: viewportRect(anchorEl),
      elementHtml: html.slice(0, MAX_ELEMENT_HTML),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
  }

  // ---- zvýraznění vlákna (klik v panelu rodiče) ----------------------------

  var highlightTimer = null;
  var highlightedEl = null;
  function highlight(commentId) {
    var pin = null;
    for (var i = 0; i < pins.length; i++) {
      if (pins[i].commentId === commentId) pin = pins[i];
    }
    var el = pin ? resolveAnchor(pin) : null;
    // Prvek nenalezen (dynamický modal ještě nevytvořen) nebo skrytý → rodič
    // ukáže uložený náhled a hlášku (spolehlivé, nezávislé na stavu stránky).
    if (!el || !isElementVisible(el)) {
      post("highlight.result", { commentId: commentId, found: false });
      return;
    }
    // Zruš předchozí zvýraznění.
    if (highlightedEl) highlightedEl.classList.remove("ph-highlight");
    highlightedEl = el;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ph-highlight");
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(function () {
      el.classList.remove("ph-highlight");
      highlightedEl = null;
    }, 2600);
    post("highlight.result", { commentId: commentId, found: true });
  }

  // ---- zprávy od rodiče ----------------------------------------------------

  window.addEventListener("message", function (e) {
    var d = e.data;
    // Jen zprávy od NAŠEHO rodiče (žádná cizí okna).
    if (e.source !== window.parent) return;
    if (!d || d.source !== "producthub-parent") return;

    if (d.type === "mode") {
      setCommenting(!!d.commenting);
    } else if (d.type === "pins.update") {
      pins = Array.isArray(d.pins) ? d.pins : [];
      renderPins();
    } else if (d.type === "highlight") {
      highlight(Number(d.commentId));
    } else if (d.type === "selection.clear") {
      // Formulář komentáře se zavřel (uložení/zrušení) → výběr zmizí.
      clearSelection();
    }
  });

  // ---- start ---------------------------------------------------------------

  function init() {
    mountOwnElements();
    // Capture fáze — klik zachytíme dřív než JS prototypu (modaly se v režimu
    // komentování neotevírají). V režimu procházení se nezachytává nic.
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    window.addEventListener("resize", scheduleReposition);
    // Scroll/resize → přepočítat pozici bubliny u vybraného prvku.
    window.addEventListener("scroll", reportSelectionMove, { passive: true });
    window.addEventListener("resize", reportSelectionMove);

    // Špendlíky se srovnávají po změnách DOM (JS-generované elementy, modaly).
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        // Změny uvnitř vlastní vrstvy nezajímají (jinak smyčka reposition).
        if (m.target instanceof Element && isOwn(m.target)) continue;
        scheduleReposition();
        return;
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
    });

    // Po navigaci na jinou stránku se skript načte znovu → ready → rodič
    // pošle aktuální režim + špendlíky té stránky.
    post("ready", { pagePath: currentPagePath() });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
