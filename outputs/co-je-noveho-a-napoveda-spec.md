# Co je nového + Nápověda - Specifikace

**ProductHub (interní aplikace PragueBest) - uvedení uživatele do novinek po nasazení a stálý návod k použití**

## Legenda markerů

| Marker | Význam |
|--------|--------|
| 🟢 | Hotovo / potvrzeno / nasazeno |
| 🟠 | Plánováno / k upřesnění |
| 🔴 | Blokováno / vyžaduje rozhodnutí |
| ⚠️ | Riziko / poznámka |
| TODO | Otevřená otázka (podsignatura PB / Dev / Hana) |

## Revize

* **2026-07-17**
  * **Implementováno** (`lib/releases.ts`, `components/whats-new-dialog.tsx`, `app/napoveda/page.tsx`, nav položka, mount v AppShellu) - ověřeno v prohlížeči (uvítání / novinky / Rozumím / Nápověda / ruční otevření). Čeká na ruční test Hany. Po schválení přesun do `specs/` - Claude
  * Rozhodnutí Hany zapracována: zapamatování v prohlížeči (`localStorage`); nový uživatel vidí **celého průvodce** (uvítání), ne „Co je nového"; odkaz na Nápovědu v levém menu - Hana Ortmannová, Claude
  * První návrh funkce - Hana Ortmannová (nápad), Claude (sepsání)

## Související dokumenty

* Hlavní specifikace aplikace - `specs/producthub-specifikace.md`
* Design dokument (technické JAK) - `docs/design-2026-07-10-producthub.md`
* Nasazovací workflow - `AGENTS.md`

> ⚠️ **Poznámka:** Dokument je rozpracovaný (`outputs/`). Po schválení Hanou se přesune do `specs/` a teprve pak se staví.

## Obsah

* [TODO (otevřené otázky)](#todo-otevřené-otázky)
* [Kontext & cíl](#kontext--cíl)
* [Rozsah](#rozsah)
* [Workflow](#workflow)
* [Obrazovka: okno „Co je nového"](#obrazovka-okno-co-je-nového)
* [Obrazovka: stránka Nápověda](#obrazovka-stránka-nápověda)
* [Zdroj novinek (releases)](#zdroj-novinek-releases)
* [Zapamatování „viděl jsem to"](#zapamatování-viděl-jsem-to)
* [Pravidla & validace](#pravidla--validace)
* [Akceptační kritéria](#akceptační-kritéria)
* [Edge casy](#edge-casy)
* [Mimo rozsah](#mimo-rozsah)
* [Provozní návyk (kdo a kdy přidává novinku)](#provozní-návyk-kdo-a-kdy-přidává-novinku)

## TODO (otevřené otázky)

| Kdo | Otázka |
|-----|--------|
| Hana | ✅ Zapamatování v prohlížeči (`localStorage`). Napříč zařízeními (DB) odloženo. |
| Hana | ✅ Nový uživatel vidí při prvním přihlášení **celého průvodce (uvítání)**, ne „Co je nového". Vracející se uživatel dostane „Co je nového" s novinkami. |
| Hana | ✅ Odkaz na Nápovědu v **levém menu**. |
| Hana | Zavření okna křížkem / Esc: má se novinka označit za viděnou (příště se neukáže), nebo jen odložit? Návrh: **odložit** (ať o novinku nepřijde); „viděl jsem to" uloží jen tlačítko „Rozumím". |

## Kontext & cíl

Aplikace se průběžně vyvíjí - přibývají funkce a mění se UI (naposledy reakce, sjednocené počty komentářů, odznaky nevyřešených). Uživatel (recenzent i autor) o změnách neví a musí je sám objevit.

**Cíl:** po nasazení novinky uživatele krátce a nevtíravě uvést do toho, co je nové, a mít stále dostupný návod, jak aplikaci používat.

**Uživatelské scénáře:**

* **Nový uživatel** se přihlásí poprvé. Uvidí **uvítací okno** - krátce, jak aplikace funguje (procházení, komentování, řešení vláken) + tlačítko „Otevřít nápovědu". Nedostane „Co je nového" (seznam změn mu nic neříká).
* **Vracející se recenzent** se přihlásí den po nasazení. Uvidí okno **„Co je nového"** se dvěma až třemi body poslední změny. Klikne „Rozumím" a pokračuje v práci. Příště už ho okno neruší.
* Nový člen projektu neví, jak komentovat. Otevře **Nápovědu** v menu a přečte si postup krok za krokem.
* Autor si chce připomenout, co bylo v posledních vydáních. V Nápovědě otevře sekci **„Historie novinek"**.

## Rozsah

**In scope:**

* Okno „Co je nového" - zobrazí se po přihlášení, když existuje novinka, kterou uživatel ještě neviděl.
* Seznam novinek vedený v kódu (`releases.ts`) - u každého vydání datum, nadpis a body.
* Zapamatování, že uživatel novinku viděl (bez databáze, v prohlížeči).
* Stránka Nápověda - návod k použití + historie novinek.
* Odkaz na Nápovědu v navigaci.
* Ruční otevření okna „Co je nového" z Nápovědy (tlačítko „Zobrazit poslední novinky").

**Out of scope (v této verzi):**

* Interaktivní prohlídka UI („našeptávač" s bublinami u tlačítek, product tour).
* Novinky cílené podle role (autor vs. recenzent) - všichni vidí totéž.
* Databázové sledování, kdo co viděl (napříč zařízeními).
* Automatické generování novinek z gitu - novinky píše člověk.
* Notifikace e-mailem o novinkách.

## Workflow

1. Uživatel se přihlásí a otevře aplikaci.
2. Systém zjistí ID nejnovějšího vydání ze seznamu novinek a přečte z prohlížeče ID posledního viděného vydání.
3. Systém rozhodne, které okno ukázat:
   * **Žádný záznam v prohlížeči (nový uživatel)** → **uvítací okno** (celý průvodce, jak aplikaci používat). NE „Co je nového".
   * **Záznam existuje, ale je starší než nejnovější vydání (vracející se uživatel)** → okno **„Co je nového"** se všemi novinkami novějšími než poslední viděné.
   * **Záznam odpovídá nejnovějšímu vydání** → nic se nezobrazí, aplikace pokračuje normálně.
4. Uživatel si okno přečte a klikne „Rozumím" (u uvítání i „Co je nového").
   * Systém uloží ID nejnovějšího vydání jako „poslední viděné".
   * Okno se zavře a příště se pro tato vydání znovu neukáže.
5. Kdykoli později může uživatel otevřít **Nápovědu** v menu.
   * Přečte si návod k použití.
   * V sekci „Historie novinek" vidí všechna vydání.
   * Tlačítkem „Zobrazit poslední novinky" znovu vyvolá okno „Co je nového".

## Obrazovka: okno (uvítání / „Co je nového")

Jedno vyskakovací okno (modal) uprostřed obrazovky, ztmavené pozadí, se **dvěma režimy** podle toho, kdo se dívá:

**Režim „Uvítání" (nový uživatel):**

* **Nadpis:** „Vítejte v ProductHubu".
* **Obsah:** krátký průvodce - 3 až 4 kroky, jak aplikaci používat (prohlédnout specifikaci, přepnout na komentování a kliknout na prvek, řešit vlákna, kde je Nápověda).
* **Tlačítka:** „Otevřít nápovědu" (přejde na stránku Nápověda) a „Rozumím" (zavře a označí za viděné).

**Režim „Co je nového" (vracející se uživatel):**

* **Nadpis:** „Co je nového".
* **Podnadpis:** datum posledního vydání (např. „17.&nbsp;7.&nbsp;2026").
* **Obsah:** seznam novinek. Každá novinka = malá ikona + nadpis + jedna až dvě věty popisu. Když je novějších vydání víc, řadí se od nejnovějšího.
* **Tlačítko „Rozumím"** - zavře okno a označí novinky za viděné.
* **Křížek / klik mimo / Esc** - zavře okno **bez** označení za viděné (uživatel si to jen odložil; příště se ukáže znovu). — TODO: potvrdit s Hanou, zda zavření křížkem má taky označit za viděné (návrh: NE, ať o novinku nepřijde).

> ⚠️ **Poznámka:** Okno se ukáže **jen jednou** po vydání, ne při každém načtení stránky. Nesmí uživatele zdržovat při běžné práci.

## Obrazovka: stránka Nápověda

Samostatná stránka `Nápověda`, dostupná z navigace.

* **Návod k použití** - stručně a krok za krokem, s malými ikonami:
  * Jak si prohlédnout specifikaci (režim procházení, drobečková navigace mezi stránkami).
  * Jak komentovat prvek (přepnout na komentování, kliknout na prvek, napsat komentář).
  * Jak odpovídat, řešit a znovu otevírat vlákna.
  * Interní vs. veřejné komentáře (kdo je vidí).
  * Reakce emoji a @zmínky členů.
  * Verze dokumentu a odznaky nevyřešených komentářů.
* **Historie novinek** - seznam všech vydání (stejný obsah jako okno „Co je nového", jen celý přehled).
* **Tlačítko „Zobrazit poslední novinky"** - znovu otevře okno „Co je nového".

Obsah Nápovědy je psaný text v aplikaci (žádný externí odkaz), aby fungoval i bez internetu mimo aplikaci.

## Zdroj novinek (releases)

Novinky se vedou jako **seznam v kódu** (`lib/releases.ts` nebo obdoba), verzovaný v gitu. Jedno vydání obsahuje:

* **id** - rostoucí celé číslo (vyšší = novější); podle něj se pozná, co uživatel ještě neviděl.
* **datum** - kdy se nasadilo.
* **nadpis** - krátký souhrn vydání.
* **body** - seznam novinek (nadpis + popis + ikona).

Výhoda: novinky jsou u kódu, projdou stejnou revizí jako kód, nevyžadují databázi ani administraci.

## Zapamatování „viděl jsem to"

* Poslední viděné ID vydání se ukládá **v prohlížeči** (`localStorage`), klíč např. `ph-last-seen-release`.
* Bez databáze (drží se pravidla „vyhýbat se DB, dokud není nutná").
* Důsledek: na novém zařízení / po smazání dat prohlížeče se okno ukáže znovu. Pro tuto verzi přijatelné. — viz TODO výše.

## Pravidla & validace

* Okno se zobrazí, **jen pokud** existuje vydání s ID vyšším než poslední viděné.
* Uživatel bez žádného záznamu (poprvé) uvidí **jen nejnovější vydání**, ne celou historii - aby ho to nezavalilo. — TODO: potvrdit (alternativa: neukázat poprvé vůbec nic a začít až od dalšího vydání).
* „Rozumím" uloží vždy **nejvyšší** dostupné ID (ne jen zobrazené), aby se starší novinky znovu neotvíraly.
* Nápověda je dostupná všem přihlášeným (recenzentům i autorům) - žádné omezení podle role.

## Akceptační kritéria

* Po přidání nového vydání do seznamu se **jednou** po přihlášení ukáže okno „Co je nového" s tímto vydáním.
* Po kliknutí „Rozumím" se okno při dalším načtení **neukáže**.
* Zavření křížkem / Esc okno odloží - při dalším přihlášení se ukáže znovu (dokud uživatel neklikne „Rozumím").
* Stránka Nápověda je dostupná z navigace a obsahuje návod i historii novinek.
* Tlačítko „Zobrazit poslední novinky" v Nápovědě okno znovu otevře.
* Uživatel, který všechny novinky viděl, žádné okno po přihlášení nedostane.

## Edge casy

* **Poprvé v aplikaci (žádný záznam):** ukáže se **uvítací okno** (celý průvodce), NE „Co je nového". Po zavření se uloží nejnovější ID, takže vracející se uživatel dostane příště jen skutečné novinky.
* **Prázdný seznam novinek:** okno se nikdy neukáže, Nápověda funguje bez sekce historie.
* **Uživatel je uprostřed práce (otevřený panel komentářů):** okno se ukáže až při čistém načtení aplikace, ne během akce, aby nepřerušilo rozdělanou práci. — TODO: potvrdit chování.
* **Smazaná data prohlížeče:** okno se ukáže znovu (bez DB to jinak nejde) - přijatelné.

## Mimo rozsah

Viz [Rozsah → Out of scope](#rozsah). Interaktivní prohlídka, cílení podle role, databázové sledování a e-mailové notifikace jsou vědomě odloženy - start simple.

## Provozní návyk (kdo a kdy přidává novinku)

Aby okno „Co je nového" dávalo smysl, přibude do nasazovacího návyku jeden krok:

> Když se nasazuje viditelná změna (nová funkce nebo změna UI), přidá se do seznamu novinek nový záznam. Drobné opravy bez dopadu na uživatele novinku nedostávají.

Doporučení: doplnit tuto větu do `AGENTS.md` (nasazovací workflow) a do `internal/CLAUDE.md`, ať se na to nezapomíná - stejný princip jako „specifikace je živý dokument".
