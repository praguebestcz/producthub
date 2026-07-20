# ProductHub - Specifikace

**PragueBest (interní aplikace) - Platforma pro sdílení, připomínkování a revizi HTML specifikací s generováním promptů pro Claude Code**

## Legenda markerů

| Marker | Význam |
|--------|--------|
| 🟢 | Hotovo / potvrzeno / nasazeno |
| 🟠 | Plánováno / k upřesnění / odloženo |
| 🔴 | Blokováno / chybí / vyžaduje rozhodnutí |
| ⚠️ | Riziko / poznámka / vyžaduje review |
| TODO | Otevřená otázka (s podsignaturou PB / Dev) |

## Revize

* **2026-07-20**
  * M7 Fáze 1 - **notifikace (zvoneček)**: server zakládá notifikace (nový komentář / odpověď / @zmínka / změna stavu) s filtrem viditelnosti (interní jen internímu příjemci), zvoneček v horní liště s počtem nepřečtených, proklik na vlákno, označení přečtení. Bez migrace (tabulka Notification z M1). Realtime (SSE) je Fáze 2. Detailní spec: outputs/m7-realtime-notifikace-spec.md - Hana Ortmannová
* **2026-07-17**
  * M8 (light) - **Prompt z komentářů**: interní tým vybere komentáře → **AI (Claude, `claude-sonnet-5`) z nich vyvodí konkrétní změny** (ne přepis - vyhodnotí i diskusi; server-side, vyžaduje `ANTHROPIC_API_KEY`) → uloží jako „zadání" (nová tabulka `PromptExport` po db-security-expert review) → seznam „Předaná zadání" se stavy (Vytvořeno/Předáno vývoji/Zapracováno), kopie/stažení .md. Zjednodušená verze původního M8 (bez schvalovacího procesu). Detailní spec: specs/m8-prompt-z-komentaru-spec.md - Hana Ortmannová
  * Uvítání nového uživatele + okno „Co je nového" po nasazení novinky + stránka Nápověda (návod + historie novinek). Novinky vedené v `lib/releases.ts`, viděné se pamatuje v prohlížeči (bez DB). Detailní spec: specs/co-je-noveho-a-napoveda-spec.md - Hana Ortmannová
  * Zpřehlednění po design review: sjednocené počty komentářů (tlačítko i panel = aktuální stránka, nápověda „+N" u přepínače Všechny stránky), navádění v prázdném panelu, odznaky nevyřešených na kartách projektů i dokumentů, popisek menu „Navigace", špendlíky se drží uvnitř stránky - Hana Ortmannová
  * Reakce emoji na komentáře (po db-security-expert review). Kompletní audit aplikace (bezpečnost/výkon/logika, 0 kritických) + zapracované opravy - viz outputs/audit-2026-07-17.md. Sandbox rozšířen na allow-forms/allow-popups (opaque origin drží). Avatar autora ve špendlíku, filtr stavu, banner režimu, drobečková navigace - Hana Ortmannová
* **2026-07-15**
  * M6 (komentáře) nasazeno na produkci; rozpracován redesign komentování ve stylu Google Docs (bublina u prvku, vyjíždějící panel, celá šířka) - doladit bublinu - Hana Ortmannová
  * M6 UX vylepšení dle ručního testu Hany: drobečková navigace mezi stránkami, výrazný přepínač režimů, čitelný popis prvku místo DOM cesty, jeden prvek = jedno vlákno, spolehlivé řešení skrytých prvků (náhled + hláška) - Hana Ortmannová
  * M6 (komentáře nad elementy) implementováno vč. bezpečnostního smoke testu (filtr interních, zmínky, limity, modaly) - čeká na ruční test Hany - Hana Ortmannová
* **2026-07-14**
  * Vydání dokumentu - zpětný zápis hotových milníků M0-M5 podle skutečného stavu aplikace, milník M6 detailně, M7-M9 jako plánovaný stav - Hana Ortmannová

## Související dokumenty

* Zadání - `inputs/claude-code-zadani-cz.md`
* Implementační plán (design dokument) - `docs/design-2026-07-10-producthub.md` - architektura, milníky, závazné podmínky ze security review
* Technická dokumentace projektu - `AGENTS.md` (stack, konvence, nasazovací workflow)
* Produkce - https://producthub-production-0484.up.railway.app

> ⚠️ **Poznámka:** Tato specifikace popisuje, CO aplikace dělá (funkční pohled). Technické JAK (datový model, API routy, bezpečnostní mechanismy) drží design dokument - obě strany se doplňují a odkazují na sebe.

## Obsah

* [TODO (otevřené otázky)](#todo-otevřené-otázky)
* [Hlavní cíle](#hlavní-cíle)
* [Rekapitulace požadavků ze zadání](#rekapitulace-požadavků-ze-zadání)
* [Kontext & cíl](#kontext--cíl)
* [Základní údaje](#základní-údaje)
* [Klíčová technická rozhodnutí](#klíčová-technická-rozhodnutí)
* [Aktuální stav](#aktuální-stav)
* [Workflow](#workflow)
* [Zobrazení na FE (obrazovky aplikace)](#zobrazení-na-fe-obrazovky-aplikace)
* [Administrace](#administrace)
* [Pravidla & validace](#pravidla--validace)
* [Případy užití](#případy-užití)
* [Nefunkční požadavky](#nefunkční-požadavky)
* [Akceptační kritéria](#akceptační-kritéria)
* [Stavy a životní cyklus](#stavy-a-životní-cyklus)
* [Edge casy](#edge-casy)
* [Notifikace v aplikaci](#notifikace-v-aplikaci)
* [Externí systémy](#externí-systémy)

## TODO (otevřené otázky)

| Kdo | Otázka |
|-----|--------|
| Dev | M7: SSE spojení se ověřuje jen při otevření - deaktivace uživatele neukončí už otevřený stream. Re-check při heartbeatu, nebo zdokumentovat jako přijaté riziko? |
| PB | Kdy zařadit backlog (aplikační logy, přehledový dashboard, čítače na kartě projektu)? Návrh: logy společně s M9, dashboard po M7. |
| PB | v2: rozsah a priorita GitHub integrace (Issues ze schválených požadavků). |

## Hlavní cíle

1. Recenzent komentuje **konkrétní HTML element** živé specifikace - ne stránku obecně.
2. Diskuse nad komentářem se převede na **strukturovaný požadavek**, který schvaluje výhradně autor projektu.
3. Systém ze schváleného požadavku vygeneruje **hotový prompt pro Claude Code** (kopie do schránky).
4. **Interní komentáře** týmu PB klient nikdy neuvidí - viditelnost vynucuje server, ne frontend.
5. Komentáře **přežijí nahrání nové verze** specifikace (přenos kotev přes `data-review-id`, jinak DOM cestu).

## Rekapitulace požadavků ze zadání

* 🟢 Projekty s více HTML dokumenty (rozcestník, prototyp, wireframy, specifikace) - hotovo (M3/M5)
* 🟢 Google login, žádná hesla v aplikaci - hotovo (M2)
* 🟢 Sdílení pozvánkami, role Autor/Komentátor/Čtenář - hotovo (M3)
* 🟠 Komentáře navázané na konkrétní HTML element (identifikátor, DOM cesta, viewport) - M6
* 🟠 Komentářová vlákna: odpovědi, @zmínky, stavy otevřený/vyřešený/znovu otevřený - M6
* 🟠 Interní vs. veřejné komentáře - M6
* 🟠 Realtime spolupráce (živé komentáře, přítomnost, indikace psaní) - M7 Fáze 2
* 🟢 Notifikace v aplikaci (zvoneček) - M7 Fáze 1 (hotovo)
* 🟠 Požadavky + generování Claude promptu - M8
* 🟠 Zachování komentářů mezi verzemi dokumentu - M9
* 🟠 GitHub integrace - přesunuto do v2 (rozhodnutí z brainstormingu; zadání ji řadilo do MVP)
* ⚠️ Screenshot elementu se NEUKLÁDÁ - místo něj HTML výstřižek elementu + velikost okna (pro Claude prompt užitečnější; sloupec v DB zůstává připravený)

Odchylky od doporučeného stacku ze zadání (závazná rozhodnutí z brainstormingu): Supabase Realtime → vlastní SSE; Vercel → Railway; backend = Next.js API routes (ne NestJS).

## Kontext & cíl

Reálné specifikace PragueBest NEJSOU statické stránky - jsou to klikací HTML prototypy nasazené na Vercelu (vzor: diskuse-deploy.vercel.app). Zpětná vazba k nim dnes chodí e‑mailem nebo ústně a ztrácí vazbu na konkrétní místo v prototypu. ProductHub dává recenzentům možnost komentovat přímo element v živé stránce, drží diskusi pohromadě a na konci vyrobí zadání, které jde rovnou vložit do Claude Code. Aplikace je interní produkt PB; klienti do ní vstupují jako pozvaní recenzenti.

### Uživatelské scénáře

* Jako **autor** chci importovat specifikaci z URL nebo nahrát ZIP a pozvat recenzenty, abych dostal připomínky na jednom místě.
* Jako **komentátor (klient)** chci kliknout na element v živém prototypu a napsat k němu komentář, aby bylo jednoznačné, čeho se připomínka týká.
* Jako **interní člen PB** chci psát interní poznámky, které klient nevidí, abychom mohli diskutovat řešení interně.
* Jako **autor** chci z vyřešené diskuse vytvořit požadavek, schválit ho a vygenerovat prompt pro Claude Code, abych zadání nemusel přepisovat ručně.
* Jako **čtenář** chci specifikaci jen prohlížet, bez možnosti zasahovat.

## Základní údaje

* **Co se implementuje:** webová aplikace ProductHub, verze v1 (milníky M0-M9)
* **Kde běží:** produkce https://producthub-production-0484.up.railway.app (Railway), lokální vývoj `localhost:3000`
* **Jazyková verze:** čeština (UI texty i komentáře v kódu)
* **Typ projektu:** standalone aplikace (typ C) - NENÍ MasterShop, žádná obálka
* **Stack:** Next.js 16.2 (App Router, `proxy.ts`), TypeScript, React 19, Tailwind 4 + shadcn/ui `base-nova`, PostgreSQL 17 + Prisma 6, jose JWT session, Zod, vitest, Sentry, Railway (NIXPACKS)

### Rozsah

**V scope (v1, milníky M0-M9):**

* Projekty seskupené pod klienty, členové, pozvánky, role (M3, M3.5)
* Správa uživatelů: tři úrovně - Uživatel / Tým (`canCreateProjects`) / Admin (M2, M4.5)
* Dokumenty: upload HTML/ZIP, import z URL (crawl), verze, sandboxovaný prohlížeč (M5)
* Komentáře nad elementy: špendlíky (s avatarem autora), vlákna, @zmínky, stavy, interní/veřejné, reakce emoji (M6)
* Realtime: živé komentáře, přítomnost, indikace psaní; notifikace v aplikaci (M7)
* Požadavky + generování Claude promptu (M8)
* Přenos komentářů mezi verzemi + dokončení (M9)

**Mimo scope (NENÍ součástí v1):**

* GitHub integrace (Issues, větve, PR) - v2
* E‑mailové notifikace - v2
* Úprava HTML obsahu specifikace v aplikaci - uživatelé NEMOHOU editovat dokumenty
* Backlog (samostatné zadání, až na ně dojde): aplikační logy, přehledový dashboard, čítače na kartě projektu, mapování projekt ↔ repozitář, akce „znovu připnout" osiřelý komentář (v1.1)

> ⚠️ **Poznámka:** Cokoli mimo „V scope" vyžaduje samostatnou specifikaci a samostatné odsouhlasení.

## Klíčová technická rozhodnutí

* **Sandboxovaný prohlížeč:** nahraný dokument běží v iframe `sandbox="allow-scripts allow-forms allow-popups"` BEZ `allow-same-origin` (opaque origin). JavaScript prototypu funguje (modaly, interakce), formuláře a otevírání oken taky, ale iframe NEMŮŽE číst cookies aplikace ani volat API jako přihlášený uživatel. Trade-off: uvnitř prototypu nefunguje localStorage/cookies - přijatelné (vzorová specifikace je nepoužívá).
* **Auth prohlížeče tokenem v URL**, ne cookie - krátkodobý view-token (~1 h), server při každém požadavku znovu ověřuje členství v projektu.
* **Import z URL je hlavní cesta** - specifikace už bývají nasazené na Vercelu. Crawl stáhne stránky stejné domény do hloubky 2 + assety; kopie je snapshot, odkazy na cizí domény zůstávají živé. ZIP upload je alternativa.
* **Kotva komentáře:** přednostně `data-review-id` (pravidlo PB pro nové specifikace), jinak DOM cesta (`domPath`) - v praxi PRIMÁRNÍ, protože starší PB specifikace `data-review-id` nemají.
* **Realtime přes SSE** (in-memory hub, 1 instance na Railway) - žádný Supabase.
* **Interní komentáře filtruje server** na všech kanálech: REST (M6), SSE (M7), notifikace (M7), požadavky a generovaný prompt (M8). Na každý kanál existuje explicitní test.

## Aktuální stav

Aplikace je nasazená na produkci a milníky M0-M5 jsou hotové a otestované Hanou:

| Milník | Obsah | Stav |
|--------|-------|------|
| M0 | Kostra projektu (Next 16.2, Tailwind 4, vitest, Docker Postgres, Sentry) | 🟢 hotovo |
| M1 | DB schéma (12 tabulek) + security review subagentem `db-security-expert` | 🟢 hotovo |
| M2 | Google OAuth, session, `/admin/users`; M2.5 design systém + sidebar | 🟢 hotovo |
| M3 | Projekty, členové, pozvánky; M3.5 složky klientů | 🟢 hotovo |
| M4 | Nasazení na Railway; M4.5 deaktivace/mazání uživatelů, tři úrovně rolí | 🟢 hotovo |
| M5 | Dokumenty: upload/import, verze, sandboxovaný prohlížeč | 🟢 hotovo |
| M6 | Komentáře nad elementy + vlákna | 🟠 implementováno - čeká na ruční test Hany |
| M7 | Notifikace (zvoneček) + realtime (SSE) | 🟠 zvoneček hotový (Fáze 1), realtime SSE plánováno (Fáze 2) |
| M8 | Požadavky + Claude prompt | 🟠 plánováno |
| M9 | Přenos komentářů mezi verzemi + dokončení | 🟠 plánováno |

DB schéma pro komentáře (`Comment`, `Mention`), požadavky (`Requirement`, `RequirementComment`) i notifikace (`Notification`) existuje od M1 - milníky M6-M8 NEVYŽADUJÍ migraci.

## Workflow

Páteř aplikace - hlavní tok od nahrání specifikace po implementaci. U kroků je uveden milník, který je pokrývá.

1. **Admin** nastaví uživateli úroveň **Tým** (smí zakládat projekty). 🟢 M2/M4.5
2. **Autor** založí projekt (volitelně pod klientem) a pozve členy e‑mailem s rolí a příznakem „interní". 🟢 M3
   * **Pozvaný má účet:** členem se stává HNED.
   * **Pozvaný nemá účet:** členem se stane při prvním přihlášení Googlem (pozvánka se páruje podle e‑mailu).
3. **Autor** nahraje dokument: import z URL (crawl), HTML soubor, nebo ZIP. Systém uloží snapshot jako verzi 1. 🟢 M5
   * **Úspěch:** dokument se objeví v projektu, otevře se prohlížeč.
   * **Neúspěch (limity, SSRF, timeout):** čitelná chyba, nic se neuloží (atomicky).
4. **Člen projektu** otevře dokument - specifikace se vykreslí v sandboxovaném iframe, navigace mezi stránkami funguje uvnitř prohlížeče. 🟢 M5
5. **Komentátor** přepne do režimu komentování, klikne na element → formulář s náhledem elementu → uloží komentář (volitelně interní, s @zmínkami). Na elementu se objeví špendlík. 🟠 M6
   * Komentovat jde KAŽDÁ stránka specifikace včetně obsahu modalů a JS-generovaných elementů (režim procházení modal otevře, režim komentování vybírá).
6. **Členové** diskutují ve vlákně (odpovědi), mění stav: **Otevřený** → **Vyřešený** → **Znovu otevřený**. 🟠 M6
   * Odpověď v interním vlákně je VŽDY interní (veřejná odpověď by unikla ven).
7. Změny se ostatním přihlášeným zobrazují **živě** (SSE) - nové komentáře, stavy, přítomní uživatelé, indikace psaní. Dotčení uživatelé dostanou notifikaci na zvonečku. 🟠 M7
8. **Autor** převede vlákno na **požadavek** (předvyplněný název, popis, dotčený element, akceptační kritéria) a schválí ho. 🟠 M8
   * Schválit požadavek smí POUZE autor projektu.
9. Systém vygeneruje **Claude prompt** (kontext projektu + omezení + element + požadavek + přepis diskuse) - autor ho zkopíruje do schránky a použije v Claude Code. 🟠 M8
   * Prompt se skládá JEN z veřejných komentářů, nebo je zobrazení omezeno na interní členy (4. kanál úniku interních komentářů).
10. Po implementaci autor nahraje **novou verzi** dokumentu - komentáře se přenesou přes kotvy (`data-review-id`, jinak `domPath`); nepřenositelné se označí „prvek už neexistuje". Požadavek projde stavy **Zapracováno** → **Uzavřeno**. 🟠 M8/M9
11. Recenzenti zkontrolují novou verzi - cyklus se opakuje. 🟠 M9

## Zobrazení na FE (obrazovky aplikace)

### Přihlášení (`/login`) 🟢

* Jediné tlačítko „Přihlásit se přes Google". Aplikace NEUKLÁDÁ hesla.
* Po přihlášení: převzetí čekajících pozvánek podle e‑mailu → dashboard.

### Dashboard (`/`) 🟢

* Karty projektů seskupené podle klientů (Nezařazené nakonec). Uživatel bez projektů vidí prázdný stav „čekáte na pozvánku".
* Tlačítko „Nový projekt" jen pro úroveň Tým a vyšší.

### Klienti (`/clients`) 🟢

* Tabulka klientů: založení, přejmenování, mazání (klient s projekty smazat NEJDE - vazba Restrict → čitelná chyba 409).
* Jen pro úroveň Tým a vyšší.

### Detail projektu (`/projects/[id]`) 🟢

* Přehled: seznam dokumentů (název, počet verzí, poslední nahrání), seznam členů.
* Nahrání dokumentu (dialog): záložky URL / soubor / ZIP, volitelný název dokumentu.

### Nastavení projektu (`/projects/[id]/settings`) 🟢

* Jen pro AUTHORA. Formulář projektu (název, popis, klient, `constraints` - omezení vkládaná do každého Claude promptu), pozvánky (e‑mail + role + interní), tabulka členů a pozvánek, nebezpečná zóna (smazání projektu s opsáním názvu).

### Prohlížeč dokumentu (`/projects/[id]/documents/[docId]`) 🟢 M5, rozšíření 🟠 M6

* 🟢 Sandboxovaný iframe se specifikací, přepínač verzí, navigace uvnitř prohlížeče.
* 🟠 M6 - drobečková navigace mezi stránkami specifikace (Rozcestník > podstránka) + tlačítko Zpět. Klik na úroveň v drobečkách přejde na tu stránku. Umožňuje pohyb mezi úrovněmi vícestránkové specifikace.
* 🟠 M6 - lišta: výrazný přepínač režimů Procházení / Komentování (jen pro roli Komentátor a vyšší; aktivní Komentování svítí barevně, ať je na první pohled jasné, v jakém režimu jsi).
  * Procházení: kliky procházejí do stránky - modaly a interakce prototypu fungují.
  * Komentování: kurzor crosshair, hover zvýrazní element, klik element VYBERE (neproklikne). Vybraný element zůstává orámovaný po celou dobu psaní komentáře.
* 🟠 M6 - postranní panel komentářů (vpravo, ~24 rem):
  * Hlavička: počet vláken, přepínač Tato stránka / Všechny stránky (u vláken z jiných stránek badge s cestou stránky).
  * Vlákno: autor + avatar + čas, badge stavu (Otevřený / Vyřešený / Znovu otevřený), badge Interní, čitelný popis prvku (např. tlačítko Odeslat dotaz - ne technická DOM cesta; syrový HTML schovaný v rozbalovátku), odpovědi chronologicky, akce Odpovědět / Vyřešit / Znovu otevřít, reakce emoji (👍 ✅ 👀 ❤️ 🎉 🙏 - chip s počtem, moje reakce zvýrazněná; u komentářů i odpovědí).
  * Klik na vlákno: element se v iframe zvýrazní (pulzující rámeček ~2,5 s) a odscrolluje. Vlákno z jiné stránky prohlížeč nejdřív na tu stránku přepne a element zvýrazní po načtení.
  * Prvek se na stránce nenajde (dynamický modal vytvářený až po interakci, nebo skrytý prvek): panel ukáže uložený náhled prvku + hlášku prvek se objeví až po otevření příslušného okna. Špendlík naskočí, jakmile okno otevřeš. Automatické otevírání cizích modalů není spolehlivé (prototyp je může vytvářet až za běhu), proto náhled, který funguje vždy.
  * Jeden prvek = jedno vlákno: klik na už okomentovaný prvek NEzaloží nový komentář, ale otevře jeho existující vlákno - další připomínky se řeší jako odpovědi v diskusi.
  * Formulář nového komentáře po výběru elementu: čitelný popis prvku, textarea s @našeptávačem členů, checkbox Interní (jen pro interní členy).
* 🟠 M6 - špendlíky: číslované značky na komentovaných elementech uvnitř iframe. Špendlík skrytého elementu (zavřený modal) se schová a objeví se, až je element vidět. Klik na špendlík (v obou režimech) aktivuje vlákno v panelu.
* 🟠 M7 - avatary přítomných, indikace psaní, živé aktualizace bez refreshe.
* 🟠 M9 - prohlížení starých verzí read-only, badge „prvek už neexistuje" u osiřelých komentářů.

### Požadavky (`/projects/[id]/requirements`) 🟠 M8

* Seznam požadavků s filtry stavů; detail: název, popis, dotčený element, akceptační kritéria, propojené komentáře, akce podle stavu (schválit - jen AUTHOR, vygenerovat prompt, zkopírovat, Zapracováno, Uzavřeno).

### Zvoneček (hlavička) 🟢 M7 Fáze 1

* Ikona zvonku v horní liště s odznakem počtu nepřečtených (strop 99+).
* Dropdown: posledních 20 upozornění - avatar aktéra, věta (odpověď / zmínka / změna stavu), náhled textu, relativní čas; nepřečtené zvýrazněné.
* Klik na položku → proklik na dokument s daným vláknem (`?comment=<rootId>`) + otevření vlákna v panelu; položka se označí přečtená. Tlačítko „Označit vše přečtené".
* Počet nepřečtených se obnovuje pollem (~60 s); živé doručení přes SSE je Fáze 2 (🟠).

## Administrace

Aplikace nemá oddělený admin systém - administrace jsou stránky uvnitř aplikace dostupné podle úrovně uživatele.

### Správa uživatelů (`/admin/users`) 🟢

1. **Přístup:** jen Admin (`isAdmin`).
2. **Výpis:** všichni přihlášení uživatelé - jméno, e‑mail, úroveň (Uživatel / Tým / Admin), stav (aktivní / deaktivovaný).
3. **Akce:** přepnutí úrovně Tým (smí zakládat projekty a klienty), deaktivace (okamžitě zneplatní session i view-tokeny), reaktivace, smazání.
4. **Pojistky:** živého admina (podle `ADMIN_EMAILS`) NEJDE deaktivovat; `isAdmin` se synchronizuje s `ADMIN_EMAILS` při přihlášení.

### Správa členů projektu (v nastavení projektu) 🟢

1. **Přístup:** jen AUTHOR daného projektu.
2. **Vstupy pozvánky:** e‑mail (text, povinné), role (select: Autor / Komentátor / Čtenář), interní (checkbox).
3. **Akce:** změna role člena, přepnutí interního příznaku, odebrání člena (odebrání čistí i přijatou pozvánku), zrušení čekající pozvánky.
4. **Pojistka:** poslední AUTHOR projektu je nedotknutelný (nejde odebrat ani degradovat).

## Pravidla & validace

### Role a oprávnění

| Akce | Čtenář | Komentátor | Autor |
|------|--------|------------|-------|
| Zobrazit projekt a dokumenty | ✅ | ✅ | ✅ |
| Číst komentáře | ✅ | ✅ | ✅ |
| Přidat komentář / odpověď, měnit stav vlákna | ❌ | ✅ | ✅ |
| Nahrát dokument / verzi | ❌ | ❌ | ✅ |
| Spravovat členy, pozvánky, nastavení, mazat | ❌ | ❌ | ✅ |
| Vytvořit / schválit požadavek, generovat prompt | ❌ | ❌ | ✅ |

* Globální úrovně: **Uživatel** (jen pozvané projekty), **Tým** (`canCreateProjects` - zakládá projekty a klienty), **Admin** (správa uživatelů).
* Nečlen projektu dostane na projektové akce **404** (existence projektu se neprozrazuje).
* AUTHOR je vždy interní (vynuceno v kódu).

### Viditelnost interních komentářů (závazné ze security review)

* Interní komentář vidí POUZE interní členové projektu. Filtr vynucuje server na 4 kanálech: REST výpis (M6), SSE události (M7), notifikace (M7), detail požadavku + generovaný prompt (M8).
* Odpověď v interním vlákně je VŽDY interní. Odpověď ve veřejném vlákně SMÍ být interní (interní poznámka) → výpis filtruje kořeny I odpovědi.
* Neinterní člen, který zkusí akci nad interním vláknem, dostane **404** (existence se neprozrazuje).
* Interní komentář od neinterního člena → **400**.

### Validace komentáře (M6)

* **Tělo komentáře:** povinné, 1-10 000 znaků (po trim).
* **HTML výstřižek elementu:** max 20 000 znaků; **DOM cesta:** max 2 000; **`data-review-id`:** max 200; **cesta stránky:** max 500; **viewport:** kladná celá čísla do 20 000.
* **Viditelnost:** enum PUBLIC / INTERNAL, výchozí PUBLIC.
* **@zmínky:** max 20, POUZE členové projektu - zmínka na nečlena → **400** (jinak únik existence projektu).
* **Request body:** max 128 kB → jinak **413**. API NEPŘIJÍMÁ pole `screenshot` (tiše se zahazuje).
* Kořenový komentář vyžaduje verzi dokumentu + cestu stránky; odpověď vyžaduje rodiče (kořen téhož dokumentu) a dědí jeho stránku i verzi. Stav a kotvu má JEN kořen.

### Dokumenty a import (M5) 🟢

* Upload: HTML ≤ 5 MB; ZIP ≤ 20 MB rozbaleno, ≤ 500 souborů, sanitizace cest (zip-slip).
* URL import: jen http(s), stejná doména, hloubka 2, max 30 stránek / 200 assetů, ≤ 5 MB/soubor, ≤ 25 MB celkem, timeout 15 s, ≤ 3 redirecty, rate-limit; SSRF ochrana s DNS pinningem (privátní rozsahy odmítnuty, jen porty 80/443).
* Ukládání verze je atomické (transakce) - při chybě se neuloží nic.

## Případy užití

### UC1 - Komentář k tlačítku v prototypu (happy path)

* **Kdo:** Komentátor
* **Předpoklady:** je členem projektu, dokument má verzi
* **Kroky:** 1. Otevře dokument. 2. Přepne na režim Komentování. 3. Najede na tlačítko - zvýrazní se. 4. Klikne → formulář s náhledem elementu. 5. Napíše text, uloží.
* **Výsledek:** na tlačítku špendlík, vlákno v panelu, stav **Otevřený**. Kotva = `data-review-id` tlačítka (existuje-li), jinak DOM cesta.

### UC2 - Komentář k elementu v modalu

* **Kdo:** Komentátor
* **Předpoklady:** prototyp otevírá modal JavaScriptem za běhu
* **Kroky:** 1. V režimu Procházení klikne na tlačítko - modal se otevře. 2. Přepne na Komentování. 3. Klikne na element UVNITŘ modalu. 4. Uloží komentář.
* **Výsledek:** komentář se váže na element modalu (DOM cesta vyhodnocená za běhu). Po zavření modalu se špendlík schová; po opětovném otevření se objeví.

### UC3 - Interní poznámka pod veřejným vláknem

* **Kdo:** interní člen PB
* **Kroky:** 1. Otevře veřejné vlákno klienta. 2. Odpoví se zaškrtnutým „Interní".
* **Výsledek:** klient (neinterní člen) vidí vlákno BEZ interní odpovědi - v UI i v odpovědi API.

### UC4 - Od komentáře k promptu (M8) 🟠

* **Kdo:** Autor
* **Kroky:** 1. Otevře vyřešené vlákno. 2. „Vytvořit požadavek" - předvyplní se z diskuse. 3. Doplní akceptační kritéria, schválí. 4. „Vygenerovat prompt" → zkopíruje do schránky. 5. Po implementaci označí **Zapracováno**, pak **Uzavřeno**.
* **Výsledek:** prompt obsahuje kontext projektu, omezení, HTML element, kritéria jako checklist a přepis diskuse (jen veřejné komentáře).

### UC5 - Nová verze a osiřelý komentář (M9) 🟠

* **Kdo:** Autor
* **Předpoklady:** verze 1 má tři komentáře: element se zachovaným `data-review-id`, element posunutý v DOM, element odstraněný
* **Kroky:** 1. Nahraje verzi 2. 2. Systém spáruje kotvy po stránkách (server staticky, prohlížeč autoritativně za běhu).
* **Výsledek:** první dva komentáře se přenesou, třetí dostane badge „prvek už neexistuje". Verze 1 dál zobrazuje původní špendlíky.

## Nefunkční požadavky

* **Bezpečnost:** sandbox iframe (opaque origin), CSP `sandbox allow-scripts allow-forms allow-popups` (formuláře/okna pro klikací prototypy; opaque origin drží, session chráněná - potvrzeno auditem 2026-07-17), `Referrer-Policy: no-referrer` na view odpovědích, view-token s claim `typ` (nejde zaměnit se session), re-check členství + deaktivace při každém view požadavku, SSRF guard s DNS pinningem, zip-slip sanitizace. Každý milník s DB/auth změnou prochází review subagentem `db-security-expert`; M9 končí závěrečným security passem.
* **Realtime limity:** SSE hub v paměti = právě 1 Railway instance (heartbeat 25 s; mitigace později Postgres LISTEN/NOTIFY). Po výpadku spojení klient přenačte komentáře (bez event replay).
* **Růst dat:** assety a HTML žijí v PostgreSQL (bytea) - hlídáno limity uploadů; velikost projektů ukázat v adminu později (backlog).
* **Provoz:** `main` = vývoj, `production` = produkce (Railway auto-deploy). Nasazení spouští VÝHRADNĚ Hana příkazem `git push origin main:production`.

## Akceptační kritéria

Milníky M0-M5 jsou akceptované (ruční test Hany proběhl u každého). Pro zbývající milníky:

**M6 - komentáře (test na importované specifikaci diskuse-deploy):**

* [ ] Klik na tlačítko v režimu komentování vytvoří špendlík + komentář (s `data-review-id`, pokud ho element má)
* [ ] Komentář na podstránce rozcestníku se váže ke správné stránce; panel ukazuje vlákna aktuální stránky + přepínač všech stránek
* [ ] Element v modalu jde komentovat; po zavření modalu špendlík zmizí, po otevření se vrátí
* [ ] Odpověď ve vlákně, vyřešení, znovu otevření fungují
* [ ] Interní komentář od interního člena A neinterní člen B NEVIDÍ - v UI ani v odpovědi API (DevTools), včetně interní odpovědi pod veřejným vláknem
* [ ] Našeptávač @zmínek nabízí jen členy; zmínka na nečlena vrací 400

**M7 Fáze 1 - notifikace (zvoneček) - HOTOVO:**

* [x] Nový komentář / odpověď / zmínka / změna stavu založí notifikaci správným příjemcům (kromě aktéra, jen aktivním členům)
* [x] Interní komentář NEZALOŽÍ notifikaci neinternímu členovi (ověřeno přes API i unit testy)
* [x] Zvoneček ukazuje počet nepřečtených; proklik otevře dané vlákno; označení přečtení funguje

**M7 Fáze 2 - realtime (SSE) - plánováno:**

* [ ] Komentář od B se u A objeví do ~1 s bez refreshe; indikace psaní; seznam přítomných
* [ ] Notifikace i živé aktualizace chodí přes SSE bez pollování

**M8 - požadavky + prompt:**

* [ ] Celá cesta komentář → požadavek → schválení (jen AUTHOR) → prompt → kopie do schránky; prompt obsahuje kontext, element, kritéria, diskusi
* [ ] Interní komentáře NEUNIKAJÍ do promptu ani do detailu požadavku pro neinterní členy

**M9 - verze + dokončení:**

* [ ] Přenos komentářů podle UC5 (přenesené + osiřelý); stará verze zobrazuje původní stav
* [ ] Závěrečný security pass bez 🔴 nálezů

## Stavy a životní cyklus

### Komentář (vlákno - stav má jen kořen)

| Stav | Popis | Z jakého stavu | Trigger |
|------|-------|----------------|---------|
| **Otevřený** | Čeká na vyřešení | — | Vytvoření komentáře |
| **Vyřešený** | Diskuse uzavřena | Otevřený, Znovu otevřený | Akce „Vyřešit" (Komentátor+) |
| **Znovu otevřený** | Vrácen do hry | Vyřešený | Akce „Znovu otevřít" (Komentátor+) |

### Požadavek (M8) 🟠

| Stav | Popis | Z jakého stavu | Trigger |
|------|-------|----------------|---------|
| **Návrh** | Vznikl z diskuse, edituje se | — | „Vytvořit požadavek" (AUTHOR) |
| **Schváleno** | Připraven ke generování promptu | Návrh | Schválení (POUZE AUTHOR) |
| **Prompt vygenerován** | Prompt uložen a zkopírován | Schváleno | „Vygenerovat prompt" |
| **Zapracováno** | Implementace hotová | Prompt vygenerován | Ruční přepnutí (AUTHOR) |
| **Uzavřeno** | Ověřeno v nové verzi | Zapracováno | Ruční přepnutí (AUTHOR) |

### Pozvánka

| Stav | Popis | Trigger |
|------|-------|---------|
| **Čekající** | Pozvaný se ještě nepřihlásil | Vytvoření pozvánky (e‑mail bez účtu) |
| **Přijatá** | Převedena na členství | První přihlášení Googlem s odpovídajícím e‑mailem; existující účet ji přijímá HNED |

### Uživatel

| Stav | Popis | Trigger |
|------|-------|---------|
| **Aktivní** | Normální provoz | Přihlášení Googlem |
| **Deaktivovaný** | Nemůže se přihlásit, session i view-tokeny zneplatněny okamžitě | Deaktivace adminem |

## Edge casy

* **Element vzniká až JavaScriptem za běhu** (tlačítka v modalech) - overlay připíná špendlíky za běhu (sledování změn DOM); statická analýza serveru takový element nevidí, proto osiřelost potvrzuje až prohlížeč (M9, dvoustupňové párování).
* **Skrytý element** (zavřený modal, sbalený panel) - špendlík se schová, komentář v panelu zůstává.
* **Prototyp používá localStorage/cookies** - v sandboxu NEFUNGUJÍ (opaque origin). U vzorové specifikace ověřeno, že je nepoužívá; u nových specifikací ověřit při importu.
* **Stránka odkazovaná až JavaScriptem** - crawl ji nestáhne (vidí jen odkazy ve zdrojovém HTML); autor doplní ZIP uploadem.
* **Souběh:** dva členové komentují současně - komentáře se nekříží (nezávislé záznamy), v M7 se zobrazí živě; do té doby po refreshi.
* **Deaktivace uživatele s otevřeným SSE streamem** - stream se neukončí okamžitě — TODO: Dev (viz tabulka TODO).
* **Smazání člena s existujícími komentáři** - komentáře zůstávají (autor je vazbou Restrict), člen ztrácí přístup.
* **Změna e‑mailu na Googlu na e‑mail existujícího účtu** - čitelná chyba, ne pád (kolize se řeší podle `googleId`).
* **Poslední AUTHOR projektu** - nejde odebrat ani degradovat (projekt by osiřel).
* **Klient s projekty** - nejde smazat (Restrict → 409 s vysvětlením).

## Notifikace v aplikaci

E‑mailové notifikace NEJSOU v v1 (v2). Notifikace v aplikaci (zvoneček, M7 Fáze 1) 🟢 - server zakládá při vzniku komentáře / změny stavu:

| Událost | Příjemci | Poznámka |
|---------|----------|----------|
| Nový kořenový komentář | členové projektu kromě aktéra | filtr viditelnosti - interní jen interním |
| Nová odpověď | účastníci vlákna | dtto |
| @zmínka | zmínění uživatelé | dedup s ostatními typy |
| Změna stavu vlákna | účastníci vlákna | |
| Schválení / uzavření požadavku | členové projektu | |

Deaktivovaným uživatelům se notifikace NESKLÁDAJÍ; v našeptávači zmínek jsou skryti.

## Uvítání, Co je nového a Nápověda 🟢

Uvedení uživatele do aplikace a do novinek po nasazení. Detailní funkční spec: `specs/co-je-noveho-a-napoveda-spec.md`.

* **Uvítací okno** - nový uživatel při prvním přihlášení uvidí okno „Vítejte v ProductHubu" s krátkým průvodcem (prohlížení, komentování, řešení vláken, kde je Nápověda).
* **Okno „Co je nového"** - vracející se uživatel po nasazení novinky uvidí seznam změn, které ještě neviděl. „Rozumím" je označí za viděné.
* **Zdroj novinek** - seznam vydání v kódu (`lib/releases.ts`), verzovaný v gitu; každé vydání má rostoucí `id`, datum, nadpis a body. Při nasazení viditelné změny se přidá nový záznam (viz AGENTS.md → Nasazování).
* **Zapamatování** - poslední viděné ID vydání se ukládá v prohlížeči (`localStorage`, klíč `ph-last-seen-release`), bez databáze. Na novém zařízení se okno ukáže znovu (přijatelné).
* **Stránka Nápověda** (`/napoveda`, v levém menu, pro všechny přihlášené) - návod k použití krok za krokem + historie novinek + tlačítko „Zobrazit poslední novinky" (znovu vyvolá okno).

## Externí systémy

* **Google OAuth** - jediný způsob přihlášení. Ověřuje se `aud`, `iss` i `email_verified` (bez toho by šla převzít pozvánka přes neověřený e‑mail). Consent screen v režimu „Testing" = max 100 testovacích uživatelů (pro MVP OK).
* **Railway** - hosting aplikace + PostgreSQL. Auto-deploy z větve `production`.
* **Sentry** (self-hosted PB) - hlášení chyb.
* **GitHub** 🟠 v2 - vytvoření Issue ze schváleného požadavku; výhledově větve a PR. **GitLab** (klientské repozitáře) - jen budoucí mapování projekt ↔ repozitář (backlog).
