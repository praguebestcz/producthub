# E-mailové notifikace - Specifikace

**ProductHub (interní aplikace PragueBest) - odesílání upozornění e-mailem, nastavitelné u uživatele**

## Revize

* **2026-07-27**
  * První návrh (brainstorming s Hanou). Volby u uživatele: Vypnuto / Okamžitě / Jen nepřečtené (chytře). Hana zvolila všechny tři možnosti hned v v1. - Claude

## TODO (otevřené otázky)

| Kdo | Otázka |
|-----|--------|
| ~~Hana~~ ✅ | Odesílací služba: **`nodemailer` přes SMTP, stejně jako vratky** (rozhodnuto Hanou 2026-07-27). Proměnné `SMTP_HOST/PORT/USER/PASS/SMTP_SECURE` + `EMAIL_FROM`, lokálně `.env`, produkce Railway. Převzata i pojistka vratek: mimo produkci se posílá jen na `TEST_EMAILS`. Bez multi-klient/DKIM (ProductHub = jedna PB adresa). Klíče nastavuje Hana. |
| ~~Hana~~ ✅ | Výchozí hodnota `emailNotify` = **OFF (opt-in)** (rozhodnuto Hanou 2026-07-27) - žádné překvapivé e-maily kolegům při nasazení; funkci oznámíme v „Co je nového" a každý si ji zapne. |
| ~~Hana/Dev~~ ✅ | Úloha na pozadí = **interní interval** v běžícím serveru (1 instance, always-on), bez další konfigurace (rozhodnuto 2026-07-27, Hana ponechala na Claudovi). |
| ~~Dev~~ ✅ | Prodleva „chytře" = **5 minut** nepřečtení (2026-07-27). |

## Kontext & cíl

Dnes chodí upozornění jen jako **zvoneček v aplikaci** (M7). Kdo nemá appku otevřenou, o dění neví. E-mailové notifikace doručí stejná upozornění do schránky. Každý uživatel si sám zvolí, zda a jak často e-maily chce. E-maily **navazují na zvoneček** - stejné události i stejná volba rozsahu (vše / jen zapojen), žádná druhá sada pravidel.

## Rozsah

### In scope
* Nová volba u uživatele **„E-mailová upozornění"** (v Nastavení, `/nastaveni`): **Vypnuto** / **Okamžitě** / **Jen nepřečtené (chytře)**.
* **Okamžitě**: e-mail odejde hned po vzniku upozornění (v návaznosti na zápis notifikace, po COMMITu, neblokuje odpověď API).
* **Jen nepřečtené (chytře)**: úloha na pozadí každých pár minut najde upozornění, která jsou po prodlevě (např. 5 min) stále nepřečtená a ještě neodeslaná, a pošle je. Kdo si upozornění v aplikaci přečte dřív, e-mail nedostane.
* E-maily respektují stávající rozsah **vše / jen zapojen** (`User.notifyScope`) - vychází z existujících `Notification` řádků, které rozsah už zohledňují.
* E-maily respektují **viditelnost interních** - e-mail vzniká jen z notifikace, která už prošla filtrem (interní jen internímu příjemci); odeslání navíc znovu ověří členství a viditelnost (obrana do hloubky).
* Obsah e-mailu: kdo, typ události (odpověď / @zmínka / změna stavu / nový komentář), úryvek textu, **odkaz rovnou na komentář** v dokumentu + odkaz do Nastavení.
* Sledování odeslání: nové pole `Notification.emailedAt` - zabrání dvojímu odeslání a slouží úloze na pozadí.

### Out of scope
* Souhrn (denní/hodinový digest) jako samostatný režim - lze doplnit později.
* HTML šablony s brandingem nad rámec jednoduchého čitelného e-mailu (v1 stačí prostý, čistý e-mail).
* E-maily o věcech mimo komentáře (pozvánky, správa účtu) - řeší se jinde / později.
* Odhlášení odkazem v patičce ve smyslu právního unsubscribe - jde o interní nástroj; místo toho odkaz „změnit nastavení".

## Workflow

**A) Režim „Okamžitě"**
1. Uživatel A přidá komentář / odpoví / @zmíní / změní stav vlákna.
2. Po COMMITu vzniknou `Notification` řádky příjemcům (stávající logika M7) + živý zvoneček (SSE).
3. Pro každého příjemce, který má `emailNotify = IMMEDIATE`, se **asynchronně** (neblokuje odpověď) sestaví a odešle e-mail; po odeslání se nastaví `emailedAt`.
4. Neúspěch odeslání se zaloguje, aplikace nespadne (upozornění v aplikaci zůstává platné).

**B) Režim „Jen nepřečtené (chytře)"**
1. Úloha na pozadí běží v intervalu (např. každé 2 min).
2. Najde `Notification`, kde: příjemce má `emailNotify = UNREAD`, `readAt IS NULL`, `emailedAt IS NULL`, `createdAt` je starší než prodleva (např. 5 min).
3. Volitelně seskupí víc upozornění jednoho příjemce do jednoho e-mailu (přehlednější, méně e-mailů).
4. Odešle, nastaví `emailedAt`. Když si mezitím uživatel upozornění přečetl (`readAt` vyplněno), e-mail se NEpošle.

**C) Režim „Vypnuto"**
* Nikdy se neposílá e-mail. `emailedAt` se nenastavuje.

## Nastavení (obrazovka)
* Do `/nastaveni` přibude sekce **„E-mailová upozornění"** vedle stávajícího rozsahu (vše / jen zapojen).
* Tři přepínače: Vypnuto / Okamžitě / Jen nepřečtené (chytře), s krátkým vysvětlením u každé volby.
* Endpoint `PATCH /api/me/email-notify` (jen vlastní uživatel ze session, Zod enum) - stejný vzor jako stávající `PATCH /api/me/notification-scope`.

## Obsah e-mailu
* Předmět: krátce a jasně, např. „Nová odpověď ve vašem vláknu - [projekt]" / „Zmínili vás - [projekt]".
* Tělo (prostý, čitelný e-mail): jméno aktéra, typ události, název projektu › dokumentu, úryvek textu, tlačítko/odkaz **Otevřít komentář** (`/projects/{p}/documents/{d}?comment={rootId}`), odkaz **Změnit nastavení upozornění** (`/nastaveni`).
* Odesílatel: adresa PB (nastavuje Hana), např. „ProductHub <no-reply@…>".

## Datový model (změny)
* Nový enum `EmailNotify { OFF, IMMEDIATE, UNREAD }`.
* `User.emailNotify EmailNotify @default(OFF)`.
* `Notification.emailedAt DateTime?` + index `@@index([emailedAt])` (úloha na pozadí filtruje podle něj).
* Změna schématu → **před migrací projde `db-security-expert` review** + výslovné „ano" Hany k DB (pravidlo user-global).

## Odesílací služba (tajemství - nastavuje Hana)
* Návrh: `nodemailer` přes SMTP. Proměnné prostředí: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. Lokálně v `.env`, na produkci Railway.
* Bez konfigurace: odesílání se **tiše přeskočí** a zaloguje (aplikace i notifikace v aplikaci fungují dál) - stejný princip jako `ANTHROPIC_API_KEY` u promptů.
* Klíče/hesla nastavuje **výhradně Hana** (Claude připraví kód i návod).

## Úloha na pozadí (režim „jen nepřečtené")
* Návrh v1: interní interval spuštěný při startu serveru (Railway 1 instance, always-on). Guard, aby běžel jen jednou.
* Alternativa (robustnější): chráněný endpoint `/api/cron/email-sweep` (tajný token) spouštěný Railway cronem. Rozhodne se dle TODO + `db-security-expert`.
* Úloha musí být odolná: chyba u jednoho e-mailu nesmí shodit celý běh ani server.

## Pravidla & validace
* E-mail vzniká **jen z existující notifikace** - dědí filtr rozsahu i viditelnosti z M7.
* Před odesláním se **znovu ověří**, že příjemce je stále členem projektu a (u interního komentáře) že stále vidí interní - jinak se e-mail nepošle (obrana do hloubky, stejně jako `GET /api/notifications`).
* Nikdy se neposílá aktérovi vlastní akce (plyne z toho, že aktér nemá vlastní notifikaci).
* Dvojité odeslání vyloučeno přes `emailedAt` (jak pro Okamžitě, tak pro sweep).
* Deaktivovaný uživatel nedostává e-maily (nemá platné notifikace / re-check členství).

## Akceptační kritéria
* Uživatel si v Nastavení zvolí Vypnuto / Okamžitě / Jen nepřečtené a volba se uloží (a projeví).
* **Okamžitě**: po odpovědi/zmínce/změně stavu dorazí příjemci e-mail s odkazem, který otevře správný komentář.
* **Jen nepřečtené**: když příjemce upozornění v aplikaci NEotevře do prodlevy, přijde e-mail; když ho otevře dřív, e-mail nepřijde.
* **Vypnuto**: nechodí žádné e-maily.
* Interní komentář nikdy nedorazí e-mailem uživateli, který nevidí interní.
* Bez nastavené SMTP konfigurace aplikace funguje, jen se e-maily neposílají (a zaloguje se to).
* Žádný e-mail se stejnou notifikací nepřijde dvakrát.

## Závazné podmínky ze security review (db-security-expert, 2026-07-27)

Verdikt: **SCHVÁLENO S VÝHRADAMI.** Samotná změna schématu je nedestruktivní (enum, `emailNotify` default OFF, nullable `emailedAt`). Do implementace jsou závazné:

* **Backfill v migraci (🔴):** `UPDATE "Notification" SET "emailedAt" = "createdAt" WHERE "emailedAt" IS NULL;` — jinak by při přepnutí na UNREAD dorazila záplava historických e-mailů. Sweep navíc bere jen notifikace mladší než ~24 h (spodní mez).
* **Atomický claim (🟠):** před odesláním `updateMany({ where: { id in ids, emailedAt: null }, data: { emailedAt: now } })`; posílá se jen skutečně zaklaimované. Bez čtení-pak-zápisu kolem `await` (dvojí odeslání při souběhu sweep × IMMEDIATE).
* **Ochrana proti zacyklení (🟠):** notifikace starší než ~24 h se už nezkouší (horní mez) / malý počet pokusů. IMMEDIATE selhání sweep nedorovnává (bere jen UNREAD) — zdokumentováno v Edge casech.
* **Sdílený re-check před odesláním (🟠):** filtr z `GET /api/notifications` (členství + `canSeeInternal` + `deactivatedAt` + existence komentáře) vytáhnout do **sdílené funkce** volané výpisem zvonečku i odesílačem; načítat **čerstvě z DB** v čase odeslání. Když re-check neprojde → `emailedAt = now()` (vyřízeno, neodesílat). E-mail je **5. kanál** úniku interních komentářů — přidat do „vynucení viditelnosti" jako testované místo.
* **Text komentáře nikdy do předmětu (🟠):** snippet jen v těle a až **po** re-checku (ať se nedostane do logu/šablony u zahozeného e-mailu).
* **Partikulární index (🟢):** raw SQL `CREATE INDEX ... ON "Notification" ("createdAt") WHERE "emailedAt" IS NULL AND "readAt" IS NULL;` (ne plný `@@index`).
* **Throttling SMTP (🟢):** strop souběžnosti odesílání; u UNREAD seskupit víc notifikací příjemce do jednoho e-mailu.
* **Logování (🟢):** do `event-log` nikdy nepsat `body`/snippet; chyby odeslání loguj s `notificationId` + adresou, bez obsahu komentáře.
* **IMMEDIATE async (🟢):** fire-and-forget si načte data vlastním dotazem (ne z request scope), s `try/catch` (neodchycený rejection nesmí shodit proces).
* **Endpoint `PATCH /api/me/email-notify` (🟢):** bez výhrad — `userId` výhradně ze session (vzor `notification-scope`), žádný IDOR.

## Edge casy
* SMTP dočasně nedostupné → zaloguje se, `emailedAt` se nenastaví, sweep to zkusí příště (u Okamžitě se nesmí zacyklit - definovat max. počet pokusů nebo nechat dorovnat sweepem).
* Uživatel přepne z Okamžitě na Vypnuto v okamžiku vzniku události → rozhoduje hodnota v čase odeslání.
* Hromada událostí najednou (import, mnoho odpovědí) → sweep i Okamžitě musí zvládnout dávku bez zahlcení SMTP (throttling / seskupení).
* Notifikace bez komentáře (kdyby vznikl jiný typ) → e-mail se pošle bez úryvku / bez prokliku na komentář, nebo se přeskočí.
