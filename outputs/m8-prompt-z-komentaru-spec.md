# M8 - Prompt z komentářů (Předaná zadání) - Specifikace

**ProductHub (interní aplikace PragueBest) - z vybraných komentářů nechat AI vyvodit konkrétní změny (prompt pro Claude Code), uložit je jako „zadání" a sledovat jeho stav**

## Legenda markerů

| Marker | Význam |
|--------|--------|
| 🟢 | Hotovo / potvrzeno |
| 🟠 | Plánováno / k upřesnění |
| 🔴 | Blokováno / vyžaduje rozhodnutí |
| ⚠️ | Riziko / poznámka |
| TODO | Otevřená otázka (podsignatura PB / Dev / Hana) |

## Revize

* **2026-07-20**
  * „Doplnit a přegenerovat": v okně promptu pole pro odpovědi autora na nejasnosti → AI přegeneruje prompt z původních komentářů + doplnění (`clarification` do generate route i AI promptu, má přednost při řešení „k upřesnění") - Hana Ortmannová (přání), Claude
  * Zvýraznění nejasností: AI označuje body, které nejdou jednoznačně určit, značkou „⚠️ K upřesnění:". V okně promptu se nad textem ukáže žluté upozornění se seznamem (počítá se živě z textu - jak autor body vyřeší, mizí). Okno promptu (tvorba i prohlížení) zvětšeno na `max-w-4xl` pro delší prompty. `lib/comments/prompt.ts` → `findClarifications` - Hana Ortmannová (přání), Claude
* **2026-07-18**
  * Zkratka: tlačítko „Vytvořit prompt" přímo u konkrétního komentáře (v akcích vlákna), ne jen přes hromadný výběr. Spinner „Generuji…" u správného místa (stav `generatingKey`: „bulk"/id vlákna) - Hana Ortmannová (přání), Claude
  * **Zásadní upřesnění (Hana):** prompt nemá komentáře jen přepsat, ale **vyvodit z nich konkrétní změny** (vyhodnotit i diskusi). Generování proto běží **přes AI (Claude, model `claude-sonnet-5`)** na serveru - z připomínek vznikne seznam změn (imperativně: Uprav/Přidej/Odstraň). Deterministický přepis komentářů slouží jen jako **podklad** pro AI. Vyžaduje `ANTHROPIC_API_KEY` (nastavuje Hana). Implementováno: `lib/ai/change-prompt.ts`, route `.../prompt-exports/generate`, spinner „Generuji…", bez klíče srozumitelná hláška - Hana Ortmannová (upřesnění), Claude
* **2026-07-17**
  * **Implementováno** (migrace `PromptExport` + CHECK limity, API create/list/patch s gate na interního člena, generátor `lib/comments/prompt.ts` + test, výběr komentářů v panelu, okno promptu, sekce „Předaná zadání" se stavy). Ověřeno lokálně: výběr → prompt (17 připomínek) → uložení → seznam → změna stavu. Čeká na ruční test Hany; po schválení přesun do `specs/` - Claude
  * Bezpečnostní revize tabulky `PromptExport` (agent `db-security-expert`): SCHVÁLENO S VÝHRADAMI. Zapracováno: denormalizovaný `documentId` (Cascade) + `documentVersionId` NoAction (ochrana historie jako u Comment), CHECK na velikost `body` (1 MB) a počet `commentIds` (500), `@default([])`, závazné aplikační kontroly (canSeeInternal na create/list/read, ověření původu verze i komentářů proti dokumentu) - Claude
  * Rozhodnutí Hany: prompty se budou **ukládat** (audit, historie, tým, neztratit práci). Zvolena **lehká** verze (jedno „zadání" = jeden prompt z výběru komentářů + jednoduchý stav), NE plný schvalovací proces z design dokumentu - Hana Ortmannová, Claude
  * První návrh - vybrat komentáře → jeden prompt / .md pro Claude Code. Rozhodnutí: jen nevyřešené, bez HTML výstřižku, celé vlákno (kořen + odpovědi), tvoří autor + interní tým - Hana Ortmannová (nápad), Claude (sepsání)

## Související dokumenty

* Hlavní specifikace aplikace - `specs/producthub-specifikace.md`
* Design dokument (technické JAK) - `docs/design-2026-07-10-producthub.md` (M8 = původní, plnější verze s ukládáním požadavků)
* Nasazovací workflow - `AGENTS.md`

> ⚠️ **Poznámka k databázi:** V schématu už existují tabulky pro **plnou** verzi M8 (`Requirement` + `RequirementComment`) z prvního návrhu - jsou ale **nepoužité** (žádná funkce do nich nezapisuje, jsou jen v kontrole mazání uživatele). Tato spec staví **lehčí** koncept „zadání" (balík komentářů → jeden prompt), který se do `Requirement` nehodí (ten je stavěný na jeden požadavek se schvalováním). Proto se přidá **nová, jednoduchá tabulka** `PromptExport`. Nepoužité `Requirement`/`RequirementComment` zatím necháváme být (neškodí); jejich úklid je samostatné rozhodnutí (mazání = jen se svolením Hany).

> ⚠️ **Bezpečnostní revize:** Nová tabulka `PromptExport` projde revizí agentem `db-security-expert` PŘED migrací. Schématu se nedotýkáme, dokud Hana nedá výslovné „ano" k databázi.

## Obsah

* [TODO (otevřené otázky)](#todo-otevřené-otázky)
* [Kontext & cíl](#kontext--cíl)
* [Rozsah](#rozsah)
* [Workflow](#workflow)
* [Obrazovka: výběr komentářů v panelu](#obrazovka-výběr-komentářů-v-panelu)
* [Obrazovka: okno s promptem](#obrazovka-okno-s-promptem)
* [Obrazovka: Předaná zadání](#obrazovka-předaná-zadání)
* [Formát promptu](#formát-promptu)
* [Datový model (návrh k revizi)](#datový-model-návrh-k-revizi)
* [Stavy zadání](#stavy-zadání)
* [Pravidla & validace](#pravidla--validace)
* [Akceptační kritéria](#akceptační-kritéria)
* [Edge casy](#edge-casy)
* [Mimo rozsah](#mimo-rozsah)

## TODO (otevřené otázky)

| Kdo | Otázka |
|-----|--------|
| Hana | ✅ Do výběru se nabízejí jen **nevyřešené** komentáře. |
| Hana | ✅ Prompt obsahuje čitelný popis prvku + kotvu (`data-review-id` / cesta), **NE** syrový HTML výstřižek. |
| Hana | ✅ Prompt tvoří **autor + interní tým** (klient-recenzent ne). |
| Hana | ✅ Prompt vychází z **celého vlákna** u prvku - kořenový komentář **i všechny odpovědi**, každá s autorem. |
| Hana | ✅ Prompty se **ukládají** (lehká verze - „zadání" + stav). |
| Dev | ✅ Bezpečnostní revize tabulky `PromptExport` hotová (SCHVÁLENO S VÝHRADAMI, zapracováno) - viz [Datový model](#datový-model-po-bezpečnostní-revizi). |

## Kontext & cíl

Recenzenti nasbírají v ProductHubu komentáře nad prvky specifikace. Autor (interní tým) je potřebuje předat vývoji. 

**Cíl:** autor vybere komentáře k zapracování, jedním klikem z nich **AI (Claude) vyvodí konkrétní změny** (ne přepis komentářů - vyhodnotí i diskusi a napíše, co se má udělat), výsledek se **uloží jako zadání** (kdo, kdy, co) a dá se sledovat jeho stav (Vytvořeno → Předáno vývoji → Zapracováno). Autor prompt zkopíruje / stáhne a vloží do Claude Code.

> ⚠️ **Klíčové:** výstupem NENÍ seznam komentářů, ale **seznam změn** vyvozený z připomínek a diskuse. Diskuse se vyhodnotí (např. závěr „přidáme přepínač" → změna „Přidej přepínač…").

**Proč ukládat (rozhodnutí Hany):** přehled „co už jsme vývoji poslali", kdo a kdy to předal, neztratit rozdělanou práci, auditní stopa přesného textu.

**Uživatelský scénář:** Autor projde nevyřešené komentáře, zaškrtne ty k zapracování, klikne „Vytvořit prompt", zkontroluje/upraví náhled, uloží → vznikne zadání. Zkopíruje ho do Claude Code. Později v seznamu „Předaná zadání" vidí, co poslal, a překlikne stav na „Zapracováno".

## Rozsah

**In scope:**

* Výběr více komentářů v panelu (zaškrtávátka + hromadná lišta), „Vybrat všechny nevyřešené".
* **Zkratka:** tlačítko „Vytvořit prompt" přímo v akcích jednoho vlákna (prompt z jediného komentáře, bez zaškrtávání).
* **AI generování** (Claude): z vybraných komentářů a diskuse vyvodí konkrétní změny (server-side, `ANTHROPIC_API_KEY`).
* Okno s náhledem změn (editovatelný text - autor může doladit); nejasné body AI označí značkou „⚠️ K upřesnění:" a okno je nad textem **zvýrazní** (počítá se živě).
* **„Doplnit a přegenerovat":** autor napíše odpovědi na nejasnosti a AI z původních komentářů + doplnění vygeneruje nový prompt.
* **Uložení promptu jako „zadání"** (nová tabulka `PromptExport`): text, kdo, kdy, verze dokumentu, zahrnuté komentáře, stav.
* Kopírování do schránky + stažení jako `.md`.
* **Seznam „Předaná zadání"** na stránce dokumentu - historie, znovuotevření, kopie/stažení, změna stavu.
* Jednoduchý **stav zadání**: Vytvořeno / Předáno vývoji / Zapracováno.
* Vše dostupné jen **internímu týmu** (autor + interní členové).

**Out of scope (drží se jako pozdější rozšíření):**

* Plný schvalovací proces z design dokumentu (návrh požadavku → schválení → 5 stavů), rozklad na jednotlivé „požadavky".
* Automatické založení GitHub Issue z zadání.
* Napojení stavu zadání zpět na stav jednotlivého komentáře (např. auto-vyřešení).
* Výběr AI modelu v UI, streamování odpovědi, vícejazyčnost promptu (napevno čeština, model `claude-sonnet-5`).

## Workflow

1. Autor (nebo interní člen) otevře dokument a panel komentářů.
2. U nevyřešených vláken se zobrazí **zaškrtávátka**. Autor vybere komentáře (nebo „Vybrat všechny nevyřešené").
3. Dole vyjede lišta s počtem vybraných a tlačítkem **„Vytvořit prompt"**.
4. Klik → server pošle vybrané komentáře a diskusi **AI (Claude)**, ta vyvodí konkrétní změny (pár vteřin, tlačítko ukazuje „Generuji…"). Výsledek se otevře v **okně s náhledem**.
5. Autor změny zkontroluje, případně **upraví přímo v okně**.
6. Autor klikne **„Uložit a zkopírovat"** (nebo „Uložit a stáhnout .md"):
   * Zadání se uloží (stav Vytvořeno).
   * Text jde do schránky / stáhne se jako `pripominky-{dokument}.md`.
7. Zadání se objeví v seznamu **„Předaná zadání"** na stránce dokumentu.
8. Autor později u zadání překliká stav (Předáno vývoji → Zapracováno), případně ho znovu otevře a zkopíruje.

Komentáře samotné workflow **nemění** (žádné auto-vyřešení).

## Obrazovka: výběr komentářů v panelu

* Každé **nevyřešené** vlákno má vlevo **zaškrtávátko**. Vyřešená vlákna zaškrtávátko nemají.
* Tlačítko **„Vybrat všechny nevyřešené"** / „Zrušit výběr".
* Výběr platí **napříč stránkami** verze (přepínač „Všechny stránky" pomůže).
* Když je vybráno aspoň 1 vlákno, dole **lišta**: „Vybráno {N} · **Vytvořit prompt**".
* Zaškrtávátka a lišta vidí **jen** interní tým.
* **Zkratka u vlákna:** v akcích každého vlákna (vedle „Odpovědět"/„Vyřešit") je tlačítko **„Vytvořit prompt"** - vygeneruje prompt jen z tohoto jednoho komentáře (i vyřešeného). Během generování ukazuje „Generuji…"; ostatní tlačítka jsou po tu dobu zamčená.

## Obrazovka: okno s promptem

Vyskakovací okno (modal):

* **Nadpis:** „Prompt z komentářů".
* **Podnadpis:** kolik komentářů, z jakého dokumentu a verze.
* **Pole názvu zadání** (předvyplněné, např. „Připomínky {datum}") - dá se přepsat.
* **Tělo:** vygenerovaný markdown v **editovatelném poli** - autor může doladit.
* **Tlačítka:** „Uložit a zkopírovat" · „Uložit a stáhnout .md" · „Zavřít" (bez uložení).

## Obrazovka: Předaná zadání

Sekce na stránce dokumentu (vidí jen interní tým):

* Seznam uložených zadání - název, kdo vytvořil, kdy, počet komentářů, **stav** (barevný odznak).
* Klik na zadání → okno s jeho textem (kopírovat / stáhnout znovu).
* **Změna stavu** - jednoduchý přepínač Vytvořeno → Předáno vývoji → Zapracováno.
* Prázdný stav: „Zatím žádná zadání. Vyberte komentáře a vytvořte první."

## AI generování (Claude)

Vlastní „přemýšlení" - z připomínek udělat změny - dělá jazykový model.

* **Kde:** server-side, route `POST /api/documents/{id}/prompt-exports/generate`. Klient jen pošle výběr (`commentIds`), server si komentáře načte z DB (autoritativně, s filtrem viditelnosti).
* **Model:** `claude-sonnet-5` (vyvážená kvalita/cena; změna jen v `lib/ai/change-prompt.ts`).
* **Vstup:** strukturovaný podklad (viz níže) + omezení projektu (`Project.constraints`, pokud jsou).
* **Systémový prompt:** model má z připomínek a diskuse **vyvodit konkrétní změny** (imperativně Uprav/Přidej/Odstraň), vyhodnotit i závěr diskuse, u každé změny uvést prvek a stránku, nejasnou připomínku označit jako otázku, nevymýšlet nad rámec připomínek.
* **Klíč:** vyžaduje `ANTHROPIC_API_KEY` (nastavuje Hana - lokálně `.env`, na produkci Railway proměnná). Bez klíče vrací route srozumitelnou hlášku (503), ne pád.
* **Náklady/limity:** max 100 komentářů na generování (strop nákladů), rate-limit 10 generování/min na uživatele.
* **Chyba AI:** srozumitelná hláška v UI (toast), okno se neotevře.

## Podklad pro AI (formát vstupu)

Deterministicky sestavený text z vybraných komentářů - **vstup pro AI**, ne finální výstup. Markdown, česky. Struktura:

```markdown
# Připomínky ke specifikaci: {název dokumentu}
Verze {číslo} · vygenerováno {datum} · {N} připomínek

## 1. {čitelný popis prvku}
- Prvek: {popis} (data-review-id: {id} | cesta: {domPath})
- Stránka: {pagePath / „Rozcestník"}
- Připomínka ({autor komentáře}): {text komentáře}
- Diskuse:
  - {autor odpovědi 1}: {text odpovědi 1}
  - {autor odpovědi 2}: {text odpovědi 2}
```

Pravidla formátu:

* Každá položka = **celé vlákno u prvku**: kořenový komentář **i všechny odpovědi** v pořadí, jak vznikly. Blok „Diskuse" se vynechá, jen když odpovědi nejsou.
* U kořene i každé odpovědi je uveden **autor**.
* Připomínky číslované vzestupně, v pořadí výběru.
* Kotva prvku: přednostně `data-review-id`, jinak cesta (domPath). Komentář bez prvku → řádek „Prvek" se vynechá.
* **Bez syrového HTML** výstřižku.

## Datový model (po bezpečnostní revizi)

Revize `db-security-expert` (2026-07-17): **SCHVÁLENO S VÝHRADAMI**. Nálezy zapracovány do finálního schématu níže.

```prisma
enum PromptExportStatus {
  CREATED     // Vytvořeno
  HANDED_OFF  // Předáno vývoji
  DONE        // Zapracováno
}

model PromptExport {
  id                Int      @id @default(autoincrement())
  // Denormalizace documentId (vzor Comment): kaskáda + rychlé přístupové kontroly.
  documentId        Int
  document          Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  // Verze, ze které zadání vzniklo. NoAction (jako Comment.documentVersionId):
  // smazání celého dokumentu projde, ale smazání JEDNOTLIVÉ verze se zadáním
  // selže — chrání historii.
  documentVersionId Int
  documentVersion   DocumentVersion @relation(fields: [documentVersionId], references: [id], onDelete: NoAction)
  // Autor zadání — Restrict (chráněná historie, jako ostatní autoři obsahu).
  createdById       Int
  createdBy         User     @relation("PromptExportCreator", fields: [createdById], references: [id], onDelete: Restrict)
  title             String   @db.VarChar(200)
  // Snapshot promptu — MŮŽE obsahovat text INTERNAL komentářů. Nikdy nevracet
  // neinternímu členovi. DB CHECK na velikost je v migraci (obrana do hloubky).
  body              String   @db.Text
  // Informativní seznam zahrnutých komentářů (snapshot v body je zdroj pravdy).
  // NEpoužívat k opětovnému načtení komentářů — obešlo by to filtr viditelnosti.
  commentIds        Int[]    @default([])
  status            PromptExportStatus @default(CREATED)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([documentId])
  @@index([documentVersionId])
  @@index([createdById])
}
```

Reverzní relace `promptExports` na `User` (relace `"PromptExportCreator"`), `Document`, `DocumentVersion`.

Ruční dodatky do migrace (Prisma je z anotací nevygeneruje - obrana do hloubky pod aplikačními limity):

```sql
ALTER TABLE "PromptExport" ADD CONSTRAINT "PromptExport_body_max_size"
  CHECK (octet_length("body") <= 1048576);
ALTER TABLE "PromptExport" ADD CONSTRAINT "PromptExport_commentIds_max"
  CHECK (array_length("commentIds", 1) IS NULL OR array_length("commentIds", 1) <= 500);
```

**Závazné podmínky z revize pro implementaci API** (create / list / read):

1. `getSessionUser` (401), dokument → `projectId` (404 když není), `requireProjectRole` (nečlen = 404).
2. **`canSeeInternal(member) === true`** - jinak 404. Klíčová brána: klient-recenzent nesmí dostat UI ani data. Platí pro create i list i read.
3. Create: `documentVersionId` musí patřit k `documentId`; **každé `commentId` musí patřit k tomuto dokumentu** (jinak cross-project leak).
4. List/read: explicitní `select`, `body` **nikdy** neinternímu členovi.

## Stavy zadání

| Stav | Význam |
|------|--------|
| **Vytvořeno** (`CREATED`) | Prompt vznikl, zatím jen uložený. |
| **Předáno vývoji** (`HANDED_OFF`) | Autor prompt předal Claude Code / vývojáři. |
| **Zapracováno** (`DONE`) | Připomínky z zadání jsou hotové. |

Přechody jsou volné (autor překlikne ručně) - žádný vynucený směr, žádné schvalování.

## Pravidla & validace

* Vytvořit / číst / měnit stav zadání smí jen **interní tým** (autor + interní členové projektu). Klient-recenzent zaškrtávátka, tlačítko ani sekci „Předaná zadání" nevidí.
* Do výběru jdou jen **nevyřešené** komentáře (OPEN / REOPENED).
* Text promptu se skládá z komentářů, které panel má (server je předfiltroval podle viditelnosti) - **interní komentáře se do promptu dostanou jen internímu členovi**, který ho tvoří. Klient prompt netvoří ani nečte → interní text neunikne.
* Uložený `body` může obsahovat interní komentáře → čtení zadání je **gate na interního člena projektu** (server-side, ne jen skrytí v UI).
* Prázdný výběr → tlačítko „Vytvořit prompt" neaktivní.
* **Generování** změn běží na serveru přes AI (Claude) - route ověří interního člena, načte komentáře z DB (filtr viditelnosti), zavolá model. **Uložení** i **změna stavu** jdou přes API (`POST` / `PATCH`) s kontrolou role a projektu.
* Interní text se do AI dostane jen u interního člena (ten jediný projde gate); klient generování ani nespustí.

## Akceptační kritéria

* Interní člen vidí zaškrtávátka a sekci „Předaná zadání"; klient-recenzent ne (ani přes přímé API - server vrací 403/404).
* „Vybrat všechny nevyřešené" označí všechna nevyřešená vlákna verze (i z jiných stránek).
* „Vytvořit prompt" otevře okno s markdownem: název dokumentu, verze, počet, číslovaný seznam připomínek s kotvou, stránkou a celou diskusí.
* „Uložit a zkopírovat" uloží zadání (objeví se v seznamu) a vloží text do schránky; „Uložit a stáhnout .md" uloží soubor.
* Zadání v seznamu jde znovu otevřít, zkopírovat a přepnout mu stav.
* Vyřešené komentáře se do promptu nedostanou.
* Text jde upravit před uložením.

## Edge casy

* **Komentář bez prvku** (obecný komentář ke stránce): vynechá se řádek „Prvek", zůstane stránka a text.
* **Prvek už neexistuje** (osiřelý komentář): kotva se dá tak, jak je uložená.
* **Velký výběr** (desítky komentářů): prompt může být dlouhý - okno roluje, text je jeden celek; `body` má délkový strop (CHECK constraint).
* **Vlákno mezitím někdo vyřeší**: při generování se bere aktuální stav z paměti panelu; vyřešené se z výběru vynechají.
* **Komentář zahrnutý v zadání se později smaže**: uložený `body` (snapshot) zůstává - audit „co šlo vývoji" se neztratí; `commentIds` může obsahovat už neexistující ID (informativní, nevadí).
* **Smazání verze/dokumentu**: zadání se smaže s verzí (Cascade) - k potvrzení revizí, jestli nechceme chránit jako u komentářů.

## Mimo rozsah

Viz [Rozsah → Out of scope](#rozsah). Plný schvalovací proces (`Requirement`), GitHub Issue, napojení na stav komentáře a AI přeformulování jsou vědomě odložené - start simple. Když se ukáže potřeba, dopíše se samostatná specifikace.
