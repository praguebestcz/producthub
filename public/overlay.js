/* ProductHub — komentovací vrstva (overlay).
 *
 * Vkládá se do KAŽDÉ servírované HTML stránky (viz lib/html/inject-overlay.ts).
 * Běží v sandboxovaném iframe (opaque origin) — s rodičem mluví VÝHRADNĚ přes
 * postMessage. Čistý JS bez build kroku.
 *
 * Protokol iframe → parent (source: "producthub-overlay"):
 *   ready            {pagePath}                — při každém načtení stránky
 *   element.selected {pagePath, dataReviewId, domPath, rect, viewportRect, point, elementHtml, viewport}
 *   anchor.moved     {viewportRect, point}     — prvek se posunul (scroll/resize)
 *   pin.clicked      {commentId}
 * Protokol parent → iframe (source: "producthub-parent"):
 *   mode            {commenting: boolean}
 *   pins.update     {pins: [{commentId, dataReviewId, domPath, status}]}
 *   presence.markers{markers: [{dataReviewId, domPath, users:[{initial,avatarUrl,color}]}]}  — kdo píše u prvku
 *   highlight       {commentId}
 *   highlight.anchor{dataReviewId, domPath}  — skok na prvek (klik „kde píše")
 */
(function () {
  "use strict";

  var MAX_ELEMENT_HTML = 20000; // musí odpovídat Zod limitu elementHtml

  // ---- stav overlaye -------------------------------------------------------
  var commenting = false; // režim komentování (crosshair, klik = výběr)
  var pins = []; // poslední pins.update od rodiče
  var typingMarkers = []; // poslední presence.markers od rodiče („kdo píše u prvku")
  // Po kliknutí je element „vybraný": hover se ZASTAVÍ a výběr zůstane
  // orámovaný, dokud rodič nepošle selection.clear (uložení/zrušení formuláře).
  // Bez toho rámeček skákal po stránce cestou myši k panelu (zpětná vazba Hany).
  var selectionActive = false;
  var selectedEl = null; // vybraný prvek — rodič u něj drží bublinu komentáře
  // Kam přesně uživatel klikl, relativně k levému hornímu rohu vybraného prvku.
  // Rodič podle toho otevře bublinu U KURZORU (ne pod celým prvkem) a po scrollu
  // ji drží na stejném místě prvku.
  var selectedPointOffset = null;

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
    // Trvalé zvýraznění po prokliku z e-mailu/zvonečku — zůstane, dokud uživatel
    // neklikne jinam / neotevře jiné vlákno (aby při načítání stránky nezmizelo).
    ".ph-highlight-static { outline: 3px solid #c8102e !important; outline-offset: 2px;",
    "  border-radius: 2px; box-shadow: 0 0 0 6px rgba(200,16,46,.18) !important; }",
    "@keyframes ph-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(200,16,46,.0); }",
    "  50% { box-shadow: 0 0 0 6px rgba(200,16,46,.35); } }",
    // Živá značka „kdo píše" u prvku (M7 Fáze 2) — avatar(y) píšících nad prvkem,
    // barva kroužku podle uživatele (--phc). Víc lidí = shluk avatarů.
    ".ph-typing { position: absolute; z-index: 2147483646; pointer-events: none;",
    "  display: inline-flex; align-items: center; }",
    ".ph-typing-av { width: 24px; height: 24px; border-radius: 50%; overflow: hidden;",
    "  margin-left: -7px; border: 2px solid #fff; background: var(--phc,#059669); color: #fff;",
    "  box-shadow: 0 0 0 2px var(--phc,#059669), 0 1px 3px rgba(0,0,0,.3);",
    "  font: 700 11px/20px sans-serif; text-align: center; text-transform: uppercase;",
    "  animation: ph-typing 1.1s ease-in-out infinite; }",
    ".ph-typing-av:first-child { margin-left: 0; }",
    ".ph-typing-av img { display: block; width: 100%; height: 100%; object-fit: cover; }",
    "@keyframes ph-typing { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }",
    ".ph-typing[data-hidden] { display: none; }",
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

  // Vrstva živých značek „kdo píše" (M7 Fáze 2) — pozicované jako špendlíky.
  var markerLayer = document.createElement("div");
  markerLayer.setAttribute("data-ph-overlay", "");
  markerLayer.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;";

  function mountOwnElements() {
    (document.head || document.documentElement).appendChild(styleEl);
    document.body.appendChild(hoverBox);
    document.body.appendChild(selBox);
    document.body.appendChild(pinLayer);
    document.body.appendChild(markerLayer);
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
    selectedPointOffset = null;
    selBox.style.display = "none";
  }

  // Při scrollu/resize drž rámeček výběru u prvku a hlas rodiči novou pozici,
  // ať u prvku zůstane i bublina komentáře.
  function reportSelectionMove() {
    if (!selectionActive || !selectedEl) return;
    var vr = viewportRect(selectedEl);
    placeBox(selBox, documentRect(selectedEl));
    post("anchor.moved", {
      viewportRect: vr,
      point: selectedPointOffset
        ? { x: vr.left + selectedPointOffset.dx, y: vr.top + selectedPointOffset.dy }
        : null,
    });
  }

  function isOwn(el) {
    return !!(el && el.closest && el.closest("[data-ph-overlay]"));
  }

  // ---- kotva elementu ------------------------------------------------------

  // Nejbližší předek s data-review-id je PŘEDNOSTNÍ kotva (pravidlo PB pro
  // specifikace — přežije nahrání nové verze). Bere se ale jen tehdy, když je
  // KOMPAKTNÍ (tlačítko, pole, karta). Velké obaly (sekce, rám diagramu) by
  // spolkly celý svůj obsah: jeden diagram = jedno vlákno a jednotlivé uzly by
  // nešly komentovat vůbec. U nich je kotvou přímo kliknutý prvek (domPath).
  var ANCHOR_MAX_AREA_RATIO = 0.25; // podíl plochy viewportu

  function isCompactAnchor(el) {
    var viewport = window.innerWidth * window.innerHeight;
    if (!viewport) return true;
    var r = el.getBoundingClientRect();
    return r.width * r.height <= viewport * ANCHOR_MAX_AREA_RATIO;
  }

  // Společná pro klik i hover — rámeček tak ukazuje přesně to, co se vybere.
  function pickAnchor(el) {
    var reviewEl = el.closest ? el.closest("[data-review-id]") : null;
    if (reviewEl && (reviewEl === el || isCompactAnchor(reviewEl))) return reviewEl;
    return el;
  }

  // Kontejnerové prvky, u kterých klik do jejich VELKÉ plochy znamená „prázdno",
  // ne konkrétní obsah (pozadí SVG diagramu, plocha sekce, buňky mřížky…).
  // Bez toho klik/hover mezi uzly diagramu orámoval celé SVG — vypadalo to,
  // že se označil celý diagram (zpětná vazba Hany). Obsahové prvky (obrázek,
  // odstavec, tvar v diagramu) sem NEpatří — velký screenshot komentovat jde.
  var CONTAINER_TAGS = {
    DIV: 1, SECTION: 1, ARTICLE: 1, MAIN: 1, HEADER: 1, FOOTER: 1,
    NAV: 1, ASIDE: 1, UL: 1, OL: 1, TABLE: 1, TBODY: 1, THEAD: 1,
    FORM: 1, FIELDSET: 1,
    svg: 1, g: 1, // SVG má tagName malými písmeny
  };
  function isEmptyArea(el) {
    return !!CONTAINER_TAGS[el.tagName] && !isCompactAnchor(el);
  }

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
    // SVG (diagramy) — tagName je u SVG malými písmeny, proto vlastní klíče.
    // Bez nich by popisek vlákna v panelu byl jen „rect" nebo „path".
    rect: "prvek diagramu",
    path: "prvek diagramu",
    circle: "prvek diagramu",
    ellipse: "prvek diagramu",
    polygon: "prvek diagramu",
    line: "spojnice",
    text: "text",
    tspan: "text",
    g: "skupina",
    svg: "diagram",
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
      var count = typeof pin.count === "number" ? pin.count : 1;
      btn.setAttribute(
        "aria-label",
        count > 1
          ? "Vlákno od " + (pin.authorName || "?") + ", " + count + " zpráv"
          : "Komentář od " + (pin.authorName || "?"),
      );
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
      // Počet zpráv ve vláknu (jako Google komentáře) — jen když je jich víc
      // než jedna. Samotný komentář bez odpovědí = jen avatar, žádné číslo.
      if (count > 1) {
        var num = document.createElement("span");
        num.className = "ph-pin-num";
        num.textContent = String(count);
        btn.appendChild(num);
      }
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
    // Uvnitř SVG (diagramy) žádné modaly nejsou — tvar uzlu má ve svém středu
    // typicky svůj textový popisek (sourozenec), a ten NENÍ překrytí.
    var ownSvg = el.closest ? el.closest("svg") : null;
    var stack = document.elementsFromPoint(cx, cy);
    for (var i = 0; i < stack.length; i++) {
      var e = stack[i];
      // Přeskoč vlastní vrstvy overlaye (špendlíky, rámečky).
      if (e.closest && e.closest("[data-ph-overlay]")) continue;
      // Prvky z TÉHOŽ SVG se navzájem nepřekrývají „jako modal".
      if (ownSvg && e.closest && e.closest("svg") === ownSvg) {
        return false;
      }
      // První „cizí" prvek odshora: pokud to je náš prvek (nebo příbuzný),
      // je navrchu = vidět. Jinak ho něco překrývá (modal) → schovat špendlík.
      return !(e === el || el.contains(e) || e.contains(el));
    }
    return false;
  }

  // VIDITELNÁ část prvku (viewport souřadnice): rect prvku oříznutý o všechny
  // předky s posuvníkem/ořezem (overflow ≠ visible), např. diagram s vodorovným
  // scrollem. Vrací null, když z prvku není vidět nic. Špendlík se umísťuje
  // k viditelné části — jinak se u prvku vyscrollovaného z výseče (nebo většího
  // než výseč) přilepil na okraj stránky a „plaval" v prázdnu (zpětná vazba
  // Hany, procesní diagram 3600 px).
  function visibleRectOf(el) {
    var r = el.getBoundingClientRect();
    var top = r.top;
    var left = r.left;
    var right = r.right;
    var bottom = r.bottom;
    var node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var style = getComputedStyle(node);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") {
        var c = node.getBoundingClientRect();
        if (c.left > left) left = c.left;
        if (c.right < right) right = c.right;
        if (c.top > top) top = c.top;
        if (c.bottom < bottom) bottom = c.bottom;
        if (right <= left || bottom <= top) return null;
      }
      node = node.parentElement;
    }
    return { top: top, left: left, right: right, bottom: bottom };
  }

  // Vzdálenost, na které se dva špendlíky ještě považují za překrývající se.
  var PIN_GAP = 28;

  function repositionAll() {
    var buttons = pinLayer.children;
    // Už rozmístěné špendlíky — nový se jim uhne, ať se nepřekrývají.
    var placed = [];
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
      // Prvek odscrollovaný mimo viditelnou výseč kontejneru → špendlík se
      // schová (objeví se, až uživatel kontejner doscrolluje k prvku).
      var vis = visibleRectOf(el);
      if (!vis) {
        btn.setAttribute("data-hidden", "");
        continue;
      }
      btn.removeAttribute("data-hidden");
      // Špendlík k pravému hornímu rohu VIDITELNÉ části prvku (viewport →
      // dokumentové souřadnice); u prvků přes celou šířku by přetekl za pravý
      // okraj a ořízl se, tak ho podržíme uvnitř stránky.
      var docWidth =
        document.documentElement.scrollWidth || document.documentElement.clientWidth;
      var left = vis.right + window.scrollX - 10;
      if (left > docWidth - 28) left = docWidth - 28;
      if (left < 2) left = 2;
      var top = vis.top + window.scrollY - 10;
      // Prvky přes celou šířku mají špendlíky ve stejném svislém sloupci; když
      // jsou dva prvky blízko pod sebou, špendlíky by se slepily. Uhni novým
      // doleva, a když už není kam, o řádek níž.
      for (var guard = 0; guard < 10; guard++) {
        var collides = false;
        for (var j = 0; j < placed.length; j++) {
          if (
            Math.abs(placed[j].top - top) < PIN_GAP &&
            Math.abs(placed[j].left - left) < PIN_GAP
          ) {
            collides = true;
            break;
          }
        }
        if (!collides) break;
        left -= PIN_GAP;
        if (left < 2) {
          left = docWidth - 28;
          top += PIN_GAP;
        }
      }
      placed.push({ top: top, left: left });
      btn.style.top = top + "px";
      btn.style.left = left + "px";
    }
    repositionMarkers();
  }

  // ---- živé značky „kdo píše" (M7 Fáze 2) ---------------------------------

  function renderMarkers() {
    markerLayer.textContent = "";
    for (var i = 0; i < typingMarkers.length; i++) {
      var m = typingMarkers[i];
      var wrap = document.createElement("div");
      wrap.className = "ph-typing";
      wrap.setAttribute("data-ph-overlay", "");
      var users = m.users || [];
      for (var j = 0; j < users.length; j++) {
        var u = users[j];
        var av = document.createElement("div");
        av.className = "ph-typing-av";
        av.style.setProperty("--phc", u.color || "#059669");
        var ini = (u.initial || "?").charAt(0) || "?";
        if (u.avatarUrl) {
          var img = document.createElement("img");
          img.alt = "";
          img.referrerPolicy = "no-referrer";
          // Když se avatar nenačte, ukáž iniciálu na barevném podkladu.
          img.onerror = (function (node, initial) {
            return function () {
              node.textContent = initial;
            };
          })(av, ini);
          av.appendChild(img);
          img.src = u.avatarUrl;
        } else {
          av.textContent = ini;
        }
        wrap.appendChild(av);
      }
      markerLayer.appendChild(wrap);
    }
    repositionMarkers();
  }

  function repositionMarkers() {
    var nodes = markerLayer.children;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var m = typingMarkers[i];
      if (!m) continue;
      var el = resolveAnchor(m);
      if (!el || !isElementVisible(el)) {
        node.setAttribute("data-hidden", "");
        continue;
      }
      var rect = documentRect(el);
      if (rect.width === 0 && rect.height === 0) {
        node.setAttribute("data-hidden", "");
        continue;
      }
      node.removeAttribute("data-hidden");
      // Štítek nad levý horní roh prvku; když by vylezl nad stránku, dovnitř.
      var top = rect.top - 20;
      if (top < 2) top = rect.top + 2;
      var left = rect.left < 2 ? 2 : rect.left;
      node.style.top = top + "px";
      node.style.left = left + "px";
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
    scheduleAnchorReport();
  }

  // ---- hlášení stavu kotev (M9 v1.1, Stupeň 2 osiřelosti) ------------------

  // Server při uploadu ověří jen existenci STRÁNKY; jestli na ní žije i
  // konkrétní PRVEK, pozná až běžící stránka. Po ustálení DOM proto pošleme
  // rodiči, které kotvy se našly a které ne.
  //
  // „Nenašla se" = selektor nevrátil NIC. Prvek nalezený, ale skrytý nebo
  // překrytý modalem, se počítá jako NALEZENÝ — existuje, jen není vidět.
  var anchorReportTimer = null;
  var lastAnchorReport = "";
  var readyAt = Date.now();

  function reportAnchorStatus() {
    // Nejdřív ~3 s po načtení — prototypy dorovnávají obsah JavaScriptem a
    // dřívější hlášení by bylo planým poplachem.
    if (Date.now() - readyAt < 3000) {
      scheduleAnchorReport();
      return;
    }
    var missing = [];
    var present = [];
    for (var i = 0; i < pins.length; i++) {
      var pin = pins[i];
      if (!pin || typeof pin.commentId !== "number") continue;
      if (resolveAnchor(pin)) present.push(pin.commentId);
      else missing.push(pin.commentId);
    }
    // Stejný výsledek podruhé neposílat (šetří zápisy i síť).
    var signature = missing.join(",") + "|" + present.join(",");
    if (signature === lastAnchorReport) return;
    lastAnchorReport = signature;
    post("anchors.status", {
      pagePath: currentPagePath(),
      missing: missing,
      present: present,
    });
  }

  function scheduleAnchorReport() {
    if (anchorReportTimer) clearTimeout(anchorReportTimer);
    // Delší klid než u repositionu — čekáme na ustálení celé stránky.
    anchorReportTimer = setTimeout(function () {
      anchorReportTimer = null;
      reportAnchorStatus();
    }, 2500);
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
    // Stejná kotva jako při kliknutí — rámeček ukazuje přesně to, co se vybere.
    var hoverAnchor = pickAnchor(target);
    if (isEmptyArea(hoverAnchor)) {
      hoverBox.style.display = "none";
      return;
    }
    placeBox(hoverBox, documentRect(hoverAnchor));
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

    // Kotva: kompaktní předek s data-review-id, jinak přímo kliknutý prvek.
    var anchorEl = pickAnchor(target);
    // Prázdná plocha velkého kontejneru (pozadí diagramu, plocha sekce) se
    // nevybírá — chová se jako klik do pozadí stránky (zavře bublinu).
    if (isEmptyArea(anchorEl)) {
      clearSelection();
      post("background.clicked");
      return;
    }
    var html = anchorEl.outerHTML || "";
    var anchorViewportRect = viewportRect(anchorEl);

    // Výběr zůstane orámovaný, dokud rodič nepošle selection.clear.
    selectionActive = true;
    selectedEl = anchorEl;
    selectedPointOffset = {
      dx: e.clientX - anchorViewportRect.left,
      dy: e.clientY - anchorViewportRect.top,
    };
    hoverBox.style.display = "none";
    placeBox(selBox, documentRect(anchorEl));
    post("element.selected", {
      pagePath: currentPagePath(),
      dataReviewId: anchorEl.getAttribute("data-review-id"),
      // domPath se počítá VŽDY (fallback kotva pro přenos mezi verzemi).
      domPath: computeDomPath(anchorEl),
      label: elementLabel(anchorEl),
      rect: documentRect(anchorEl),
      // viewportRect = pozice v prohlížeči → bublina komentáře u prvku.
      viewportRect: anchorViewportRect,
      // Bod kliknutí → bublina se otevře U KURZORU. U velkých prvků (diagram,
      // dlouhá sekce) by pozice podle rectu skončila daleko od místa, které
      // uživatel komentuje.
      point: { x: e.clientX, y: e.clientY },
      elementHtml: html.slice(0, MAX_ELEMENT_HTML),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
  }

  // ---- zvýraznění vlákna (klik v panelu rodiče) ----------------------------

  var highlightTimer = null;
  var highlightedEl = null;

  // Zruší jakékoli aktuální zvýraznění (pulz i trvalé).
  function clearHighlight() {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
    if (highlightedEl) {
      highlightedEl.classList.remove("ph-highlight");
      highlightedEl.classList.remove("ph-highlight-static");
      highlightedEl = null;
    }
  }

  // Naroluj k prvku a zvýrazni ho. persist=true → po pulzu zůstane statické
  // zvýraznění (proklik z e-mailu/zvonečku), aby nezmizelo během načítání stránky.
  function highlightEl(el, persist) {
    clearHighlight();
    highlightedEl = el;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ph-highlight");
    highlightTimer = setTimeout(function () {
      el.classList.remove("ph-highlight");
      if (persist) {
        el.classList.add("ph-highlight-static");
      } else {
        highlightedEl = null;
      }
      highlightTimer = null;
    }, 2600);
  }

  function highlight(commentId, persist) {
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
    highlightEl(el, persist);
    post("highlight.result", { commentId: commentId, found: true });
  }

  // Skok na prvek podle kotvy (klik na „kde píše") — bez vazby na špendlík.
  function highlightAnchor(anchor) {
    var el = resolveAnchor(anchor);
    if (!el || !isElementVisible(el)) {
      post("highlight.result", { found: false });
      return;
    }
    highlightEl(el);
    post("highlight.result", { found: true });
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
      // Nová sada špendlíků → po ustálení ohlásit, které kotvy na stránce žijí.
      scheduleAnchorReport();
    } else if (d.type === "presence.markers") {
      typingMarkers = Array.isArray(d.markers) ? d.markers : [];
      renderMarkers();
    } else if (d.type === "highlight") {
      highlight(Number(d.commentId), !!d.persist);
    } else if (d.type === "highlight.anchor") {
      highlightAnchor({ dataReviewId: d.dataReviewId, domPath: d.domPath });
    } else if (d.type === "selection.clear") {
      // Formulář komentáře se zavřel (uložení/zrušení) → výběr zmizí.
      clearSelection();
    } else if (d.type === "highlight.clear") {
      // Rodič zavřel/přepnul vlákno → zruš trvalé zvýraznění prvku.
      clearHighlight();
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
    // Scroll VNOŘENÉHO kontejneru (např. diagram s vlastním vodorovným
    // posuvníkem) nebublá — chytáme ho v capture fázi. Bez toho špendlíky
    // i rámeček výběru zůstanou stát, zatímco obsah pod nimi ujede.
    document.addEventListener(
      "scroll",
      function (e) {
        if (e.target === document || e.target === window) return; // řeší window listener
        reportSelectionMove();
        // Rovnou, bez debounce — s ním špendlíky během scrollu kontejneru
        // stály na starém místě a pak skočily („lítají", zpětná vazba Hany).
        repositionAll();
      },
      { capture: true, passive: true },
    );

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
    readyAt = Date.now();
    post("ready", { pagePath: currentPagePath() });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
