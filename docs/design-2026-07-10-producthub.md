# ProductHub - implementační plán

## Kontext

Hana dala do `producthub/inputs/claude-code-zadani-cz.md` zadání nové webové aplikace: platforma pro sdílení, připomínkování a revizi HTML specifikací (prototypy, wireframy, funkční specifikace). Recenzenti komentují konkrétní HTML elementy, nad komentáři běží diskuse, autor je převede na strukturovaný požadavek a systém vygeneruje hotový prompt pro Claude Code. Složka `C:\Users\hanao\Desktop\AI\producthub` je prázdná (jen `inputs/`) - projekt na zelené louce.

## Rozhodnutí z brainstormingu (závazná)

* **Rovnou produkční MVP**, ne prototyp.
* **Stack stejně jako aplikace vratek** (`C:\Users\hanao\Desktop\AI\vratky`): Next.js 16.2 + TypeScript + Tailwind 4 (bez shadcn, ikony lucide-react), PostgreSQL 17 + Prisma 6 (lokálně docker compose, produkce Railway), jose JWT session cookie, Zod, vitest, Sentry, `railway.json` (NIXPACKS). České UI texty i komentáře v kódu. ŽÁDNÝ Supabase, žádný Vercel.
* **Přihlášení: Google login** (OAuth, žádná hesla se neukládají) - jediná odchylka od vratek.
* **Přístup:** přihlásit se může kdokoli s Google účtem, ale nic nevidí, dokud není pozvaný do projektu. Projekty smí zakládat jen uživatelé s příznakem `canCreateProjects` (nastavuje admin).
* **Rozsah v1:** projekty, nahrání HTML (soubor/ZIP) + import z URL (vždy vlastní kopie), pozvánky + role (Autor/Komentátor/Čtenář), komentáře nad elementy, vlákna (odpovědi, @zmínky, stavy otevřený/vyřešený/znovu otevřený), interní vs. veřejné komentáře, požadavky + generování Claude promptu (kopie do schránky), realtime (živé komentáře, přítomnost, indikace psaní), notifikace jen v aplikaci (zvoneček), historie verzí dokumentů s přenosem komentářů přes `data-review-id`.
* **v2 (MIMO rozsah v1):** GitHub integrace, e-mailové notifikace.
* **Screenshot elementu NE** - místo něj se ukládá HTML výstřižek elementu + velikost okna (pro Claude prompt užitečnější; sloupec `screenshot Bytes?` zůstane připravený).
* **Vzorová specifikace (požadavek Hany, analyzováno 2026-07-10):** reálné PB specifikace NEJSOU statické stránky - jsou to **klikací prototypy**: samostatné HTML soubory s vloženým CSS a JavaScriptem, nasazené na Vercelu se strukturou rozcestníku. Vzor https://diskuse-deploy.vercel.app/ (`index.html` → `microsite.html` klikací prototyp, `wf.html` wireframy, `annotated.html` popis komponent, `spec.html`). Analýza vzoru: JS otevírá modaly a panely, **některé elementy vytváří až za běhu** (`createElement` - např. tlačítka „Odpovědět · Nahlásit" u příspěvků), používá externí CDN (Google Fonts, flagcdn), NEpoužívá localStorage/cookies/fetch (sandbox opaque origin mu nevadí - ověřeno), a NEOBSAHUJE žádné `data-review-id` (kotva `domPath` bude v praxi primární, dokud PB nezačne `data-review-id` do specifikací přidávat). Soubory jsou servírované staticky → URL crawl funguje (ověřeno stažením). **Komentovat a diskutovat musí jít KAŽDÁ stránka specifikace včetně obsahu modalů a JS-generovaných elementů.** Dokument = celý balík stránek (snapshot webu), komentář se váže na (verze dokumentu, cesta stránky, element). Navigace mezi stránkami uvnitř prohlížeče funguje a komentovací vrstva se vkládá do každé HTML stránky.
* **Import z URL = hlavní cesta** (specifikace jsou většinou nasazené na Vercelu): import stáhne vstupní stránku + prolinkované HTML stránky ze STEJNÉ domény (do hloubky 2, max ~30 stránek) + statické assety ze stejné domény (CSS, JS, obrázky, fonty), vše uloží jako snapshot verze. Odkazy na cizí domény zůstávají živé. ZIP upload je alternativa pro lokální deploy složky.
* **Modaly a interaktivní elementy (požadavek Hany):** komentovat musí jít i elementy zobrazené až po interakci (modal, dropdown). Řeší přepínač režimů: režim procházení (klik funguje normálně, modal se otevře) vs. režim komentování (klik = výběr elementu). Špendlíky u aktuálně skrytých elementů se schovají a zobrazí se, až je element vidět (MutationObserver + resize).
* **Bezpečnostní pravidlo Hany:** před vytvořením DB schématu vznikne projektový subagent `.claude/agents/db-security-expert.md` a schéma + auth + přístupové kontroly projdou jeho review (stejně jako u vratek - poznámky „po expert review" ve schématu).
* **Ruční testování:** každý milník končí přesným návodem krok za krokem, co si Hana lokálně vyzkouší. Automatické testy ruční test nenahrazují.

## Architektura

### Datový model (`prisma/schema.prisma`)

Enumy: `ProjectRole (AUTHOR|COMMENTER|READER)`, `DocumentSource (UPLOAD|URL)`, `CommentVisibility (PUBLIC|INTERNAL)`, `CommentStatus (OPEN|RESOLVED|REOPENED)`, `RequirementStatus (DRAFT|APPROVED|PROMPT_GENERATED|IMPLEMENTED|CLOSED)`, `NotificationType`.

Modely (klíčová pole):

* **User** - `googleId @unique`, `email @unique` (lowercase), `name`, `avatarUrl?`, `canCreateProjects @default(false)`, `isAdmin @default(false)`, `tokenValidFrom` (zneplatnění session, vzor vratky)
* **Project** - `name`, `description?`, `constraints?` (omezení projektu vkládaná do každého Claude promptu), `createdById` (Restrict)
* **ProjectMember** - `projectId`+`userId` (`@@unique`), `role`, `isInternal @default(false)` (řídí viditelnost interních komentářů; AUTHOR je vždy interní - vynuceno v kódu)
* **Invitation** - `projectId`+`email` (`@@unique`), `role`, `isInternal`, `acceptedAt?`. Při prvním přihlášení Googlem se čekající pozvánky s odpovídajícím e-mailem převedou na ProjectMember.
* **Document** - `projectId`, `name`, `sortOrder`. Aktuální verze = max `versionNumber`. Dokument = celý balík stránek (např. rozcestník + podstránky).
* **DocumentVersion** - `documentId`+`versionNumber` (`@@unique`), `entryPath String @default("index.html")` (vstupní stránka), `source`, `sourceUrl?`, `uploadedById`. VŠECHNY soubory verze (včetně HTML stránek) jsou Asset řádky - žádné zvláštní pole `html`.
* **Asset** - vázán na verzi (`documentVersionId`+`path` `@@unique`), `contentType`, `size`, `data Bytes` - každá verze je samostatný snapshot
* **Comment** - `projectId` (denormalizace pro přístupové kontroly + SSE), `documentId`, `documentVersionId` (Restrict - historie), `pagePath String` (která HTML stránka uvnitř verze), `authorId` (Restrict), `parentId?` (vlákno; kotva/stav jen u kořene), `body`, `visibility`, `status`, kotva: `dataReviewId?`, `domPath?`, `elementHtml? @db.Text`, `screenshot Bytes?` (v1 nevyužito), `viewportWidth/Height?`, `isOrphaned @default(false)`, `resolvedById?/resolvedAt?`; index `[documentId, pagePath, status]`
* **Mention** - `commentId`+`userId` (`@@unique`)
* **Requirement** - `projectId`, `documentId?` (SetNull), `title`, `description`, `acceptanceCriteria`, `affectedElement?`, `status`, `generatedPrompt? @db.Text`, `approvedById?/approvedAt?`, `closedAt?`
* **RequirementComment** - vazba požadavek ↔ komentáře (`@@unique`)
* **Notification** - `userId` (příjemce), `type`, `projectId`, `commentId?`, `requirementId?`, `actorId?`, `readAt?`; indexy `[userId, readAt]`, `[userId, createdAt]`

Přítomnost a psaní: BEZ tabulky - jen v paměti SSE hubu.

### Google OAuth + session

* `lib/google-oauth.ts` - autorizační URL (scope `openid email profile`, `state` v krátkodobé cookie), výměna kódu, ověření `id_token` přes jose `createRemoteJWKSet` proti Google JWKS
* Routes: `app/api/auth/google/route.ts`, `.../google/callback/route.ts` (upsert User dle `googleId`, převzetí pozvánek dle e-mailu, nastavení `session` cookie), `.../logout`, `.../me`
* `proxy.ts` - hlídá vše kromě `/login`, `/api/auth/*`, `/view/*` a statiky; klouzavé obnovení session (vzor vratky)
* Bootstrap adminů: env `ADMIN_EMAILS` - při přihlášení dostanou `isAdmin` + `canCreateProjects`; správa v `/admin/users`
* Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `JWT_SECRET`, `DATABASE_URL`, `POSTGRES_PASSWORD`, `ADMIN_EMAILS`

### Zobrazení dokumentu + komentovací vrstva (jádro aplikace)

* **Servírování HTML: token v cestě.** `app/view/[token]/[[...path]]/route.ts` - `token` = krátkodobý jose JWT `{versionId, userId, exp ~1h}` vydaný přes `POST /api/versions/[versionId]/view-token` (kontrola členství). Prázdná cesta → redirect na `entryPath`. Cesta na Asset s `contentType: text/html` → streamuje se s injektovaným `<script src="/overlay.js" defer>` (server-side, `lib/html/inject-overlay.ts`; u `source=URL` navíc `<base href={sourceUrl}>`) - overlay je tedy v KAŽDÉ stránce specifikace, i v podstránkách rozcestníku. Ostatní assety se servírují binárně s `X-Content-Type-Options: nosniff`. Assety žijí pod stejným token prefixem → relativní odkazy mezi stránkami fungují bez přepisování HTML a navigace v rámci specifikace zůstává uvnitř prohlížeče.
* **XSS ochrana:** iframe `sandbox="allow-scripts"` BEZ `allow-same-origin` → nahraný dokument běží v opaque originu: jeho JS funguje (modaly, interakce), ale nemůže číst naše cookies ani volat API jako uživatel. Proto je auth v URL tokenu, ne v cookie. Navíc hlavička `Content-Security-Policy: sandbox allow-scripts` na view response. Trade-off: uvnitř prototypu nefunguje localStorage/cookies - přijatelné.
* **`public/overlay.js`** (čistý JS, bez build kroku). postMessage protokol: iframe→parent `ready {pagePath}` (posílá se při každém načtení stránky - parent tak ví, na které stránce specifikace uživatel právě je, a pošle špendlíky pro tuto stránku), `element.selected {pagePath, dataReviewId, domPath, rect, elementHtml, viewport}`, `pin.clicked`; parent→iframe `pins.update`, `highlight`, `mode {commenting}`. Parent ověřuje `event.source === iframe.contentWindow`. `domPath` = CSS selektorový řetěz (`tag:nth-of-type`, stop na nejbližším `id`); preferovaná kotva = `closest('[data-review-id]')`. Postranní panel zobrazuje vlákna aktuální stránky + přepínač „všechny stránky".
* **Režimy:** procházení (klik prochází do stránky - modaly fungují) / komentování (crosshair, klik zachycen s `preventDefault` = výběr elementu). Špendlíky jsou absolutně pozicované PRVKY UVNITŘ iframe dokumentu (scrollují s obsahem zdarma); zarovnání na `resize` + debounced MutationObserver; špendlík skrytého elementu (zavřený modal) se schová.

### Import

* **HTML soubor:** multipart POST, limit ~5 MB → jediný Asset `index.html`
* **ZIP** (`lib/zip-import.ts`, adm-zip): sanitizace cest (zip-slip), limity ≤20 MB rozbaleno / ≤500 souborů, všechny soubory → Asset řádky, `entryPath` = kořenový `index.html` (nebo autor vybere v dialogu). Každá HTML stránka v ZIPu je komentovatelná.
* **URL** (`lib/url-import.ts`): řízený crawl celé specifikace - stáhne vstupní stránku, přes node-html-parser najde odkazy (`a[href]`) a assety (`link/script/img/srcset`, `url()` v CSS) na STEJNÉ doméně; HTML stránky do hloubky 2, limity: max ~30 stránek, ≤5 MB/soubor, ≤25 MB celkem, timeout 15 s/požadavek, ≤3 redirecty. Vše uloží jako Asset řádky pod relativními cestami (navigace pak funguje uvnitř prohlížeče). Odkazy na cizí domény zůstávají živé (načítají se z internetu). **SSRF ochrana** (`lib/ssrf-guard.ts`): jen http(s), DNS resolve + odmítnutí privátních rozsahů, kontrola při každém požadavku i redirectu. Součást security review.

### Realtime - SSE

* `GET /api/projects/[projectId]/events` - `text/event-stream`, heartbeat 25 s, kontrola členství, spojení nese `{userId, isInternal, role}`
* `lib/realtime/hub.ts` - in-memory `Map<projectId, Set<Connection>>` (Railway = jeden trvalý Node proces). `publish(projectId, event, {internalOnly?})` - události interních komentářů jen interním spojením (stejný filtr i v REST výpisech a notifikacích - vynucení viditelnosti na 3 místech, explicitní testy!)
* Události: `comment.created/updated/deleted`, `reply.created`, `comment.status_changed`, `requirement.updated`, `notification.new` (jen příjemci), `presence.state` (celý seznam při join/leave), `typing` (klient skryje po 4 s)
* Reconnect: nativní EventSource auto-reconnect; po znovupřipojení klient přenačte komentáře (bez event replay)
* Známý limit: hub v paměti = max 1 Railway replika (dokumentovat; mitigace později Postgres LISTEN/NOTIFY)

### Claude prompt

`lib/prompt-template.ts` - čistá funkce (unit-testovatelná) skládající markdown: kontext projektu (název, popis, `constraints`) → dotčený dokument + verze → dotčený element (`data-review-id`, DOM cesta, HTML výstřižky z propojených komentářů) → požadavek (název, popis, akceptační kritéria jako checklist) → přepis propojené diskuse → fixní omezení (neměnit nesouvisející kód, zachovat `data-review-id` atributy). `POST /api/requirements/[id]/generate-prompt` (jen AUTHOR, jen stav APPROVED) → uloží `generatedPrompt`, stav `PROMPT_GENERATED`. UI: náhled + „Zkopírovat do schránky".

### Notifikace

Zápis ve stejné transakční cestě jako akce (`lib/notifications.ts`): kořenový komentář → členové projektu (filtr viditelnosti, bez aktéra); odpověď → účastníci vlákna; zmínka → zmínění (dedup); změna stavu → účastníci vlákna; schválení/uzavření požadavku → členové. Push přes SSE, zvoneček v hlavičce s počtem nepřečtených, proklik na `/projects/x/documents/y?comment=z`. API: `GET /api/notifications?unread=1`, `POST /api/notifications/read`.

### Mapa stránek a API

Stránky: `/login` · `/` (seznam projektů / prázdný stav „čekáte na pozvánku") · `/projects/new` · `/projects/[id]` (přehled) · `/projects/[id]/settings` (členové, pozvánky - jen AUTHOR) · `/projects/[id]/documents/[docId]` (review UI: iframe + postranní panel, `?version=n&comment=id`) · `/projects/[id]/requirements` + detail · `/admin/users`.

API: auth (4 routes) · projects CRUD · members/invitations · documents (multipart/URL) + versions + view-token · comments + replies + status · events (SSE) + typing · requirements + approve + generate-prompt + status · notifications · admin/users. Vše projektové přes `lib/auth.ts`: `getSessionUser`, `requireProjectRole(userId, projectId, minRole)`, `canSeeInternal(member)`.

## Milníky (každý končí ručním testem Hany)

* **M0 - Kostra projektu:** Next 16.2 + TS + Tailwind 4 + eslint + vitest + docker-compose (Postgres 17, container `producthub-postgres`) + `.env.example` (česky, s příkazy na generování tajemství) + `AGENTS.md`/`CLAUDE.md` + `railway.json` + Sentry soubory (DSN prázdné).
  *Test: `docker compose up -d` zdravý; `npm run dev` → stránka „ProductHub" na localhost:3000; `npm test` projde.*
* **M1 - DB schéma + povinné security review:** NEJDŘÍV vytvořit `.claude/agents/db-security-expert.md`; navrhnout celé `schema.prisma`; spustit review (schéma + auth návrh + přístupové kontroly + SSRF/upload limity); zapracovat nálezy s komentáři „po expert review"; teprve pak `prisma migrate dev`; `lib/prisma.ts`, `lib/env.ts`.
  *Test: migrace projde; `npx prisma studio` ukáže všechny tabulky.*
* **M2 - Google OAuth + session + admin:** návod pro Hanu na založení Google OAuth klienta (redirect `http://localhost:3000/api/auth/google/callback`), auth routes, `proxy.ts`, `/login`, hlavička s avatarem + odhlášení, `ADMIN_EMAILS`, `/admin/users`.
  *Test: přihlášení Googlem → prázdný dashboard; inkognito s 2. účtem → přihlásí se, nic nevidí; admin přepne 2. uživateli `canCreateProjects`.*
* **M3 - Projekty, členové, pozvánky:** založení projektu, settings, pozvánka e-mailem + role + interní příznak, převzetí pozvánky při přihlášení, změna role / odebrání.
  *Test: A založí projekt, pozve B jako Komentátora; B se přihlásí (inkognito) → projekt vidí; A odebere B → B po refreshi přístup ztratí.*
* **M4 - První nasazení na Railway:** Railway projekt + Postgres, env proměnné, produkční OAuth redirect, Sentry DSN, deploy. Brzké nasazení ověří OAuth + migrace v produkci dřív, než přijdou těžké funkce.
  *Test: produkční URL, přihlášení, založení projektu, pozvánka - stejné chování jako lokálně.* > ⚠️ Deploy provede Claude až po výslovném svolení Hany (bezpečnostní pravidla).
* **M5 - Dokumenty + prohlížeč:** upload HTML / ZIP / import URL, seznam verzí, view-token + `/view/[token]/...`, sandboxovaný iframe, navigace mezi stránkami uvnitř (zatím bez komentářů).
  *Test s reálnou specifikací: import URL https://diskuse-deploy.vercel.app/ → stáhne se rozcestník + microsite.html, wf.html, annotated.html, spec.html; rozcestník se vykreslí, prokliky fungují uvnitř prohlížeče; klikací prototyp (microsite.html) funguje včetně modalů (opaque origin trade-off); alternativně zazipovat `vratky-prodej-deploy/` a nahrát jako ZIP; nahrát/importovat 2. verzi → přepínač verzí ukáže v1/v2.*
* **M6 - Komentáře nad elementy + vlákna:** overlay.js, režim procházení/komentování, klik na element → formulář s info o elementu, špendlíky, panel vláken, odpovědi, @zmínky (našeptávač ze členů), stavy, interní/veřejné se server-side filtrem.
  *Test: kliknout na tlačítko v dokumentu → špendlík + komentář s `data-review-id`; přejít na podstránku rozcestníku a komentovat element TAM (komentář se váže ke správné stránce, panel ukazuje vlákna aktuální stránky); otevřít modal v režimu procházení, přepnout na komentování, komentovat element v modalu; odpovědět; vyřešit/znovu otevřít; interní komentář od A nesmí vidět neinterní B - zkontrolovat v UI i v API odpovědi v DevTools.*
* **M7 - Realtime + notifikace:** SSE endpoint + hub, živé události, avatary přítomných, indikace psaní, tabulka Notification + zvoneček + označení přečtení.
  *Test: dvě okna (A + B inkognito) nad stejným dokumentem: B přidá komentář → u A se objeví do ~1 s bez refreshe; indikace psaní; seznam přítomných; A zmíní B → B zvoneček živě; označit přečtené.*
* **M8 - Požadavky + Claude prompt:** vlákno → návrh požadavku (předvyplněný), editace, schválení (jen AUTHOR), generování promptu, kopie do schránky, přechody Zapracováno/Uzavřeno, seznam s filtry stavů.
  *Test: celá cesta komentář → „Vytvořit požadavek" → kritéria → schválit → „Vygenerovat prompt" → zkopírovat → vložit do editoru a ověřit obsah (kontext, element HTML, kritéria, diskuse) → Zapracováno → Uzavřeno.*
* **M9 - Přenos komentářů mezi verzemi + dokončení:** migrace kotev ve DVOU stupních (kvůli klikacím prototypům, kde elementy vznikají až JavaScriptem za běhu a statická analýza je nevidí):
  * *Stupeň 1 - server (při uploadu, `lib/html/anchor-migration.ts`, node-html-parser):* párování po stránkách přes `pagePath`. Kotva statická nalezena (`data-review-id`, jinak `domPath`) → komentář potvrzen. Stránka v nové verzi chybí → rovnou `isOrphaned`. Kotva staticky NEnalezena → komentář se NEoznačí za osiřelý (element může vznikat až JS za běhu), zůstává „neověřený".
  * *Stupeň 2 - prohlížeč (autoritativní):* overlay při zobrazení stránky zkusí připnout špendlíky; kotvy, které se nepodařilo připnout ani za běhu (po ustálení DOM - MutationObserver), nahlásí parentu a ten je označí `isOrphaned`. Osiřelost tedy potvrzuje až reálný běh stránky.
  * Dál: badge „prvek už neexistuje", prohlížení starých verzí read-only, prázdné stavy, chybové toasty, rate-limiting uploadů, závěrečný security pass (znovu db-security-expert), README, redeploy.
  *Test: nahrát v2, kde jeden element zachoval `data-review-id`, jeden se posunul, jeden zmizel → první dva komentáře se přenesou, třetí je osiřelý; v1 pořád zobrazí původní špendlíky.*

## Rizika a poznámky

1. Opaque origin sandboxu rozbije localStorage/cookies uvnitř prototypů - u vzoru diskuse-deploy OVĚŘENO, že je nepoužívá (žádné localStorage/cookie/fetch). U dalších specifikací ověřit v M5.
2. `domPath` je v praxi PRIMÁRNÍ kotva - reálné PB specifikace zatím žádné `data-review-id` neobsahují. Špendlík na JS-generovaném elementu se opírá o domPath vyhodnocený za běhu. Doporučení pro PB do budoucna: přidávat `data-review-id` do nových specifikací (stabilnější přenos komentářů mezi verzemi). UI musí osiřelé komentáře ukazovat srozumitelně (v1.1: akce „znovu připnout").
3. SSE na Railway: nutná 1 instance (hub v paměti), heartbeaty proti idle timeoutům.
4. Bytea assety + HTML v Postgresu rostou - limity uploadů, velikost projektu ukázat v adminu později.
5. Google OAuth consent screen v režimu „Testing" = max 100 testovacích uživatelů - pro MVP OK.
6. Next 16 se liší od tréninkových dat (proxy.ts, streaming) - řídit se `node_modules/next/dist/docs/` (pravidlo z AGENTS.md vratek).
7. Vynucení viditelnosti interních komentářů na 3 místech (REST, SSE, notifikace) - explicitní testy + položka security review.
8. URL crawl najde jen odkazy přítomné ve zdrojovém HTML - stránky/assety, na které se odkazuje až JavaScriptem za běhu, nestáhne. PB klikací prototypy jsou samostatné soubory s vloženým CSS/JS a odkazy `<a href>` ve zdroji (ověřeno na diskuse-deploy) → crawl funguje; kdyby něco chybělo, autor doplní ZIP uploadem.

## Závazné podmínky ze security review (M1, db-security-expert, 2026-07-10)

Verdikt: SCHVÁLENO S VÝHRADAMI. Nálezy nad schématem a docker-compose zapracovány před první migrací (NoAction na Comment.documentVersionId, indexy Notification + FK indexy, Restrict na approvedById, bind DB na 127.0.0.1, CHECK constrainty na velikost bytea). Zbývající nálezy jsou ZÁVAZNÉ pro implementaci milníků:

* **M2 (auth):**
  * Ověření id_tokenu: `aud === GOOGLE_CLIENT_ID`, `iss ∈ {accounts.google.com, https://accounts.google.com}` a `email_verified === true` (bez toho jde převzít pozvánku přes neověřený e-mail).
  * Session cookie: `httpOnly`, `secure` v produkci, `sameSite: "lax"`, `path: "/"`, expirace ~8 h s klouzavým obnovením, kontrola `iat >= tokenValidFrom`.
  * Tokeny mají claim `typ`: `"session"` vs. `"view"` - proxy odmítne jiný typ než session, view route jiný typ než view (view token je v URL, nesmí jít použít jako session).
  * Upsert podle googleId s kolizí e-mailu (změna e-mailu na Googlu na už existující účet) → čitelná chyba, ne 500.
* **M5 (view route + import):**
  * View route znovu ověřuje členství v projektu (ne jen při vydání tokenu) + kontrola `tokenValidFrom`.
  * View odpovědi mají `Referrer-Policy: no-referrer` (token v URL nesmí utéct přes Referer do cizích domén odkazovaných z prototypu).
  * SSRF: DNS pinning (připojit na již ověřenou IP, ne znovu resolvovat), rozsahy navíc: `0.0.0.0/8`, `100.64.0.0/10`, `fe80::/10`, IPv4-mapped IPv6 (`::ffff:0:0/96`), jen porty 80/443.
  * `<base href={sourceUrl}>` plošně nefunguje (rozbil by navigaci ve snapshotu) - fallback na původní doménu řešit jinak (např. při 404 na asset).
  * Jednoduchý rate-limit na URL import už v M5 (ne až M9), limit komprimované velikosti ZIPu a počtu záznamů před rozbalením.
* **M4.5 (deaktivace uživatelů, review 2026-07-13):**
  * Deaktivace = `deactivatedAt` + SOUČASNĚ bump `tokenValidFrom` (zabíjí session na proxy vrstvě i view tokeny). Reaktivace `tokenValidFrom` nevrací.
  * M5 view route kontroluje i `deactivatedAt` (obrana do hloubky pod bumpem).
  * M7: SSE spojení se ověřuje jen při otevření - deaktivace neukončí už otevřený stream; re-check při heartbeatu, nebo zdokumentovat jako přijaté riziko. Notifikace deaktivovaným neskládat; v @mention našeptávači a výpisech členů deaktivované skrýt/označit.
  * Živého admina (dle ADMIN_EMAILS) nejde deaktivovat; `isAdmin` se synchronizuje s ADMIN_EMAILS oběma směry při přihlášení.
* **M6 (komentáře):**
  * Interní komentáře mají 4. kanál úniku: detail požadavku a `generatedPrompt` (přepis diskuse). Výpis propojených komentářů filtrovat dle `canSeeInternal`; prompt skládat jen z PUBLIC komentářů, nebo zobrazení omezit na interní členy. Testy vynucení = 4 místa.
  * Zod limity textů: `body ≤ 10 000`, `elementHtml ≤ 20 000`, `domPath ≤ 2 000`, `dataReviewId ≤ 200` znaků + limit velikosti request body. API v v1 nesmí přijímat pole `screenshot`.
  * @zmínka jen na členy projektu (jinak únik existence/názvu projektu nečlenovi).

## M5 dokončeno (2026-07-13, po security review)

Implementováno: import z URL (crawl same-origin, 5 stránek diskuse-deploy ověřeno), upload HTML/ZIP, servírování v sandboxovaném iframe (`/view/[token]`), přepínač verzí, minimální overlay.js. Bezpečnostní review (db-security-expert) verdikt: schváleno s výhradami, VŠE zapracováno:
* 🔴 obejití SSRF přes hex-tvar IPv4-mapped IPv6 (`::ffff:a9fe:a9fe`) → přepsáno na kontrolu nad normalizovanými bajty (`ipv6ToHextets`), test pokrývá.
* 🟠 strop na počet stahovaných assetů (`maxAssets` 200); contentType assetů z přípony, ne z odpovědi cizího serveru.
* Ověřeno OK: view-token (typ, re-check členství + deactivatedAt + tokenValidFrom), CSP `sandbox allow-scripts` + Referrer-Policy no-referrer + nosniff na každé odpovědi, opaque origin (session nejde ukrást), DNS pinning, zip-slip, přístupové kontroly (AUTHOR upload, READER view).
* Poznámka pro M6: modal v prototypu se otevírá (JS běží — potvrzeno JS-generovanými tlačítky), doladit pozici/komentování v modalech.

## Backlog (nápady mimo rozsah v1 milníků)

* **Aplikační logy (požadavek Hany, 2026-07-10):** stránka s logy po vzoru vratek - `lib/event-log.ts` (události error/warn do PostgreSQL, maskování tajemství: tokeny, hesla; e-mail se nemaskuje kvůli vyhledávání) + admin stránka `/admin/logs`. NEMUSÍ být v bočním menu - stačí URL, případně odkaz ze správy uživatelů. Vhodný okamžik: společně s M9 (dokončení) nebo hned po nasazení M4, až bude co logovat (importy, generování promptů, chyby přihlášení).
* **Složky klientů (požadavek Hany, 2026-07-10):** entita Klient (DDS, Foto Škoda, Harfasport, … včetně PB) seskupující projekty pod sebou - kopíruje strukturu `projects/{klient}/`. Znamená model `Client` + `Project.clientId` + seskupený dashboard. Navrhované zařazení: **M3.5** (hned po schválení M3, dokud je schéma mladé a migrace levná).
* **Čítače na kartě projektu (požadavek Hany, 2026-07-10):** počet nevyřešených komentářů (a případně požadavků čekajících na schválení) přímo na kartě projektu na dashboardu. Realizovat až budou existovat komentáře (M6) / požadavky (M8) - pak jen `_count` s filtrem stavu.
* **Přehledový dashboard (požadavek Hany, 2026-07-10):** úvodní stránka s přehledem přes projekty (poslední aktivita, otevřené komentáře, čekající požadavky) + odkazy na logy a styleguide. Vhodné po M7 (až bude co přehledově ukazovat).
* **Mapování projekt ↔ repozitář (požadavek Hany, 2026-07-10):** u projektu evidovat repozitář (URL, větev) jako přípravu na integraci. Rozdělení platforem (upřesnila Hana): **GitLab = klientské repozitáře** (kód klientů PB - sem míří mapování projektů a budoucí stažení repa přímo v aplikaci), **GitHub = nasazení ProductHubu a specifikací** (deploye HTML specifikací, repo aplikace; sem míří v2 vytváření Issues ze schválených požadavků dle zadání). Pole `Project.repoUrl`/`repoBranch` lze přidat levně kdykoli; plná integrace = v2 a musí počítat s oběma platformami.
* Smazání `components/legacy/`, `components/app-header.tsx`, `components/user-menu.tsx` a pomocných souborů `_auth-debug.log`, `_txtest.mjs`, `_mktoken.mjs` + záloh cache ve scratchpadu - čeká na výslovné svolení Hany.

## Ověření (celkově)

Po každém milníku ruční test Hany podle návodu (viz milníky). Automaticky: `npm test` (vitest - prompt-template, anchor-migration, ssrf-guard, zip sanitizace, přístupové kontroly), `npm run typecheck`, `npm run lint`. Před nasazením na Railway vždy výslovné svolení Hany. Design dokument (tento plán) se po schválení uloží i do `producthub/docs/` jako referenční spec.
