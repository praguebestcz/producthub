# Kritická analýza redesignu komentování - inspirace špičkovými nástroji

**ProductHub - porovnání našeho komentování živých HTML specifikací s předními hráči a doporučení**

## Revize

* **2026-07-16**
  * Vydání - kritické zhodnocení redesignu (bublina + panel) proti Figmě, Google Docs a nástrojům na feedback k webům (BugHerd, Pastel, Markup.io) - Hana Ortmannová

## Kdo řeší stejný problém a jak

Náš případ = komentování **živých HTML prototypů/specifikací**. To přesně dělají dvě rodiny nástrojů:

**A) Feedback k živým webům (nejbližší náš případ):** BugHerd, Pastel, Markup.io, Marker.io, Ruttl, Userback.
* **Bez účtu, bez rozšíření, bez instrukcí.** Klient otevře **sdílený odkaz** (token) a komentuje **do 30 sekund**. Tři vlastnosti, které podle srovnání rozhodují o tom, jestli klient feedback vůbec dá: žádný login, žádné rozšíření prohlížeče, rozhraní bez návodu.
* **Pin na přesné místo**, drží se u prvku.
* **Automaticky zachytí kontext:** screenshot, prohlížeč, operační systém, velikost okna, URL - vývojář hned ví, kde a v čem to vzniklo.
* **Komentář → úkol** na nástěnce (BugHerd = Kanban), stavy todo/probíhá/hotovo.
* **Proxy** (Markup.io načte jakoukoli veřejnou URL bez zásahu do kódu) vs. snapshot (náš přístup - vlastní kopie).

**B) Komentování v designu/dokumentech:** Figma, Google Docs.
* **Composer u pinu je malý** - tlačí na krátkou, srozumitelnou zpětnou vazbu.
* **Piny viditelné hned, s avatarem autora a náhledem vlákna na hover;** při nahuštění se **seskupují do clusterů**, aby nezaplnily plochu.
* **Reakce emoji** - „vidím / souhlasím" jedním klikem, nižší bariéra než psát.
* **Hledání a řazení** komentářů (podle data, osoby).
* Google Docs: bublina u textu + postranní panel + **Vyřešit** + režim návrhů.

## Kde stojíme my (redesign z 2026-07-15/16)

**Co máme dobře a odpovídá špičce:**
* 🟢 Bublina nového komentáře **přímo u prvku** (Figma / Google Docs pattern).
* 🟢 Pin na přesné místo, drží se i při scrollu, funguje i pro prvky vytvořené JavaScriptem za běhu (modaly).
* 🟢 Vlákna, odpovědi, @zmínky, stavy (Otevřený/Vyřešený/Znovu otevřený).
* 🟢 Dokument přes celou šířku, vyjíždějící panel, drobečková navigace mezi stránkami.
* 🟢 **Interní vs. veřejné komentáře se server-side filtrem** - tohle konkurence takhle jemně NEMÁ; naše výhoda (tým PB řeší interně, klient nevidí).
* 🟢 Snapshot verze + přenos komentářů mezi verzemi (plán M9) - většina feedback nástrojů verzování nemá.
* 🟢 Generování promptu pro Claude Code (M8) - unikátní, nikdo z konkurence nedělá.

**Kde zaostáváme (mezery oproti špičce):**

| # | Mezera | Kdo to má | Dopad |
|---|--------|-----------|-------|
| 1 | **Klient se musí přihlásit Googlem + být pozvaný** | BugHerd, Pastel, Markup (sdílený odkaz bez účtu) | 🔴 Velká bariéra pro netechnické klienty - hlavní důvod, proč feedback nedají |
| 2 | **Piny jsou holé číslované** (bez avataru, bez náhledu na hover, bez clusterů) | Figma | 🟠 Hůř se orientuje, kdo co a kde |
| 3 | **Nezachycujeme prohlížeč/OS** (jen velikost okna) | BugHerd, Marker.io | 🟠 Vývojář nezná prostředí, kde připomínka vznikla |
| 4 | **Žádné reakce (emoji)** | Figma | 🟠 Nutí psát i tam, kde stačí „palec nahoru" |
| 5 | **Seznam bez filtrů/řazení/hledání** | Figma, Google Docs | 🟠 Při desítkách komentářů se ztrácí přehled |
| 6 | **Přepínač Procházení/Komentování** je nutné zlo (kvůli klikacím prototypům) | - (Figma režim nemá, ale nemá ani klikací obsah) | 🟠 Malá bariéra - držet co nejjasnější (výrazný přepínač už máme) |

## Doporučení (seřazeno podle poměru dopad/úsilí)

### Hned - dokončit doladění (malé, kolega už testuje)
* **Oprava: v drobečkách nejde kliknout na „Rozcestník" z podstránky** (nahlásila Hana) - bug, opravit.
* **Po uložení komentáře z bubliny automaticky otevřít panel** s tím vláknem (nahlásila Hana) - lepší zpětná vazba, že se komentář uložil.

### Brzy - levná vylepšení blízko špičky (malé/střední úsilí, velký UX efekt)
* **Piny jako Figma:** avatar autora v pinu, náhled vlákna na hover, barevně dle stavu (máme částečně). Seskupení do clusteru při překrytí.
* **Zachytit prohlížeč + OS** ke komentáři (levné - z `navigator`), doplnit k viewportu. Pomáhá vývojáři i Claude promptu.
* **Filtr a řazení v seznamu:** nevyřešené / všechny, moje / všechny, řazení dle data. `_count` a filtr, malá práce.
* **Reakce emoji** na komentář (👍 ✅ 👀) - nižší bariéra než psát; potřebuje malou tabulku Reaction.

### Strategické - největší pákový efekt, ale větší práce a bezpečnostní dopad
* **Sdílený odkaz pro klienta bez Google účtu (guest access).** Tohle je největší rozdíl oproti BugHerd/Pastel/Markup a přímo souvisí s tvojí otázkou na security sdílení: znamenalo by to **tokenový odkaz s omezeným rozsahem** (jen čtení / jen komentování, jen konkrétní dokument, expirace), místo plného účtu. MUSÍ projít `db-security-expert` review (kdo přes odkaz uvidí co, izolace mezi klienty, zneplatnění odkazu). Zapadá do backlog položky „server-side ochrana citlivých dat". Doporučení: navrhnout jako samostatný milník po M7/M8, ne teď narychlo.
* **Komentář → úkol / stav workflow** (BugHerd Kanban) - u nás to řeší „Požadavky" (M8), takže už plánováno.

## Závěr

Náš redesign je **koncepčně na úrovni špičky** (bublina + pin + panel = Figma/Google Docs vzor) a v pár věcech je **nad konkurencí** (interní/veřejné komentáře, verze, generování Claude promptu). Největší reálná mezera je **bariéra přihlášení pro klienty** - tu řeší guest odkaz, což je zároveň bezpečnostní téma (patří do samostatného milníku s review). Krátkodobě největší poměr efekt/úsilí mají **doladění (2 opravy) + „chytřejší piny" + kontext prohlížeče/OS + filtry v seznamu**.

## Zdroje

* BugHerd - srovnání visual feedback nástrojů: https://bugherd.com/blog/best-visual-feedback-tools
* Pastel - website annotation tools: https://usepastel.com/blog/10-best-website-annotation-software-tools-for-client-feedback-2026
* Markup.io - visual feedback tools: https://www.markup.io/blog/visual-feedback-tools/
* Figma - redesignované komentáře (piny, reakce, náhledy, clustery): https://www.figma.com/blog/stay-in-the-flow-with-redesigned-comments/
* Figma - průvodce komentáři: https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma
