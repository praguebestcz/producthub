# M7 - Realtime + notifikace - Specifikace

**ProductHub (interní aplikace PragueBest) - notifikace (zvoneček) a živá spolupráce nad komentáři**

## Legenda markerů

| Marker | Význam |
|--------|--------|
| 🟢 | Hotovo / nasazeno |
| 🟠 | Plánováno / k upřesnění |
| 🔴 | Blokováno / vyžaduje rozhodnutí |
| ⚠️ | Riziko / poznámka |
| TODO | Otevřená otázka (PB / Dev / Hana) |

## Revize

* **2026-07-20**
  * První návrh. Rozděleno na **Fázi 1 (notifikace / zvoneček)** a **Fázi 2 (realtime přes SSE)**. Tabulka `Notification` už v DB existuje (z prvního schématu) - **bez migrace**. Hana dala mandát postavit samostatně - Claude

## Související dokumenty

* Hlavní specifikace: `specs/producthub-specifikace.md`
* Design dokument: `docs/design-2026-07-10-producthub.md` (M7 + rizika SSE)
* Filtr viditelnosti: `lib/comments/visibility.ts`

## Kontext & cíl

Dnes se komentáře načtou jen při otevření dokumentu a uživatel nevidí, že na něj někdo reagoval nebo ho zmínil, dokud si stránku sám neotevře. M7 přidává **notifikace (zvoneček)** a **živou spolupráci** (komentáře naživo, přítomnost).

**Cíl Fáze 1:** uživatel v horní liště vidí zvoneček s počtem nepřečtených upozornění (odpověď, @zmínka, změna stavu vlákna), rozklikne je a přejde rovnou na místo.

**Cíl Fáze 2:** komentáře a upozornění chodí **naživo** (bez obnovení stránky); u dokumentu je vidět, kdo je právě přítomný.

## Rozsah

### Fáze 1 - Notifikace (zvoneček) - staví se první

**In scope:**

* Vznik notifikace při událostech (server-side, v transakci se zápisem komentáře):
  * **Nový kořenový komentář** → členům projektu kromě autora.
  * **Nová odpověď** → účastníkům vlákna (autor kořene + kdo odpověděl) kromě autora.
  * **@zmínka** → zmíněným uživatelům.
  * **Změna stavu vlákna** (vyřešeno / znovu otevřeno) → účastníkům vlákna kromě aktéra.
* **Viditelnost:** notifikace o INTERNÍM komentáři vznikne JEN internímu příjemci (závazné - třetí ze tří kanálů filtru vedle REST a SSE).
* **Deaktivovaným** uživatelům se notifikace neskládají.
* **Dedup:** na jednu akci max. jedna notifikace na příjemce (zmínka má přednost před „odpověď/nový komentář").
* **Zvoneček** v horní liště: počet nepřečtených, seznam posledních (aktér, útržek textu, kdy), klik → přechod na dokument + zvýraznění komentáře.
* **Označení přečtení:** klik na notifikaci ji označí přečtenou; tlačítko „Označit vše přečtené".
* Počet nepřečtených se v Fázi 1 obnovuje periodicky (poll ~60 s) - v Fázi 2 nahradí SSE (živě).

**Out of scope Fáze 1:** živé doručení (SSE), přítomnost, indikace psaní, e-mailové notifikace.

### Fáze 2 - Realtime (SSE)

**Hotovo (přítomnost + psaní):**

* 🟢 SSE endpoint `/api/documents/[id]/presence` (in-memory hub `lib/presence/hub.ts`, Railway = 1 instance), heartbeat 20 s.
* 🟢 **Přítomnost:** avatary uživatelů, kteří mají dokument otevřený (lišta v prohlížeči, **barva per uživatel** dle userId), + indikace **kdo právě píše** komentář. „Píše" se ukáže na 3 místech: u avataru v liště, **přímo u prvku na stránce** (avatar píšícího přes overlay; víc lidí u jednoho prvku = shluk avatarů) a **u vlákna v panelu**. Signál nese umístění (stránka + prvek/vlákno).
* 🟢 **Skok na místo psaní:** klik na avatar píšícího v liště naroluje a zvýrazní prvek, kde právě píše (i přes stránky; u odpovědi otevře jeho vlákno v panelu). Overlay zpráva `highlight.anchor`.
* 🟢 **Viditelnost (závazné):** EXTERNÍ (klient) NEVIDÍ interní přítomné ani jejich psaní; INTERNÍ vidí všechny. Filtr per spojení na serveru (`computeRoster`, čistá funkce + testy).
* 🟢 Heartbeat re-ověřuje session i členství (deaktivace / odebrání ukončí stream; změna interního příznaku obnoví filtr); úklid při odpojení (abort).

**Živé doručení:**

* 🟢 Nový komentář / odpověď / změna stavu se u ostatních u dokumentu objeví **bez obnovení**. Server po zápisu pošle SSE signál `comments` (`signalCommentsChanged` v hubu), klient (`usePresence` → `loadComments`, debounce 250 ms) přenačte. Signál NEnese data komentářů - každý klient si je natáhne přes GET s **vlastním filtrem viditelnosti** (interní se neinternímu nepošle). Ověřeno naživo.
* 🟠 Zvoneček (upozornění) naživo - zatím poll ~60 s (nahradit SSE per uživatel) - zbývá.

### Fáze 1b - Volba notifikací per uživatel 🟢 (hotovo)

* Uživatel si v **Nastavení** (`/nastaveni`, odkaz v menu u jména) zvolí: **vše** (default) / **jen když jsem zapojen** (@zmínka NEBO odpověď/změna stavu ve vláknu, které založil nebo v něm psal).
* DB: enum `NotifyScope { ALL, INVOLVED }` + `User.notifyScope @default(ALL)` (migrace `20260721120000_add_notify_scope`, po db-security-expert review + „ano" Hany). Bez backfillu (default = dosavadní chování).
* Endpoint `PATCH /api/me/notification-scope` (userId ze session, Zod enum). `computeRecipients` bere mapu preferencí: `INVOLVED` nedostane „nový kořenový komentář" (NEW_COMMENT), pokud není zmíněn; odpovědi/změny stavu (účastník) a zmínky chodí vždy. Preference NEMĚNÍ filtr viditelnosti interních. Ověřeno naživo.

## Workflow (Fáze 1)

1. Uživatel A napíše odpověď / zmíní B / vyřeší vlákno.
2. Server v transakci zapíše komentář/změnu a založí notifikace příjemcům (podle pravidel + viditelnosti, kromě aktéra, jen aktivním).
3. Uživateli B se v horní liště u zvonečku ukáže počet nepřečtených (při dalším načtení / pollu).
4. B rozklikne zvoneček, vidí seznam. Klik na položku → přejde na dokument, komentář se zvýrazní, notifikace se označí přečtená.
5. „Označit vše přečtené" vynuluje počet.

## Obrazovka: zvoneček

* Ikona zvonku v horní liště (vedle přepínače motivu), s **badge počtu nepřečtených** (99+ strop).
* Dropdown: seznam posledních ~15 notifikací - avatar aktéra, věta („{aktér} odpověděl na vlákno", „{aktér} vás zmínil", „{aktér} vyřešil vlákno"), čas, útržek textu. Nepřečtené zvýrazněné.
* Nahoře „Označit vše přečtené"; prázdný stav „Žádná upozornění".
* Klik na položku → `/projects/{p}/documents/{d}` + zvýraznění komentáře.

## Datový model

**Beze změny** - `Notification` už existuje: `userId` (příjemce), `type` (enum), `projectId`, `commentId?`, `actorId?`, `createdAt`, `readAt?`. Typy pro M7: `NEW_COMMENT`, `NEW_REPLY`, `MENTION`, `COMMENT_STATUS_CHANGED` (+ `PROJECT_INVITED` volitelně). Migrace NENÍ potřeba.

## Pravidla & validace

* Notifikace se zakládají **server-side** ve stejné transakci jako komentář/změna.
* **Nikdy** aktérovi sobě; **nikdy** deaktivovaným; INTERNÍ komentář jen internímu příjemci.
* `GET /api/notifications` vrací JEN notifikace přihlášeného; `POST /api/notifications/read` označí jeho notifikace.
* Útržek/aktér ve výpisu přes explicitní `select` (nevracet víc, než je třeba).

## Akceptační kritéria (Fáze 1)

* Odpověď na vlákno → účastníci (kromě autora) dostanou notifikaci; zvoneček ukáže počet.
* @zmínka → zmíněný dostane notifikaci typu „zmínka".
* Vyřešení/znovuotevření → účastníci dostanou notifikaci.
* Interní komentář → neinterní člen notifikaci NEDOSTANE (ani přes API).
* Deaktivovaný uživatel notifikace nedostává.
* Klik na notifikaci přejde na dokument a zvýrazní komentář; označí ji přečtenou.
* „Označit vše přečtené" vynuluje počet.

## Edge casy

* Zmíněný člen je zároveň účastník vlákna → jen JEDNA notifikace (dedup, typ zmínka).
* Komentář nemá kotvu (obecný) → notifikace stále vznikne, klik přejde na stránku.
* Příjemce mezitím ztratí přístup k projektu → notifikaci ve výpisu neukazovat (re-check členství při GET).
* Velký projekt (mnoho členů) → nový kořenový komentář založí notifikaci každému členovi (kromě autora) přes `createMany`.

## Bezpečnost (server-side review M7, 2026-07-22)

Cílený review db-security-expert nad novým M7 kódem: **schváleno s výhradami, 0 kritických.** Potvrzeno vynucené na serveru: filtr interní ⊄ externí na všech 3 kanálech (notifikace `computeRecipients`, přítomnost `computeRoster` per spojení, živé doručení = signál bez dat), autorizace + heartbeat re-check + úklid, `notifyScope` jen zužuje, `/nastaveni` bez IDOR/CSRF, `getUserFromToken` shodné kontroly.

Zapracované výhrady (hardening):

* 🟢 **Rate-limit + strop spojení SSE** - `rateLimit(presence:userId, 30/60 s)` na otevření + strop 8 souběžných spojení na uživatele+dokument (proti zahlcení / růstu paměti).
* 🟢 **Rate-limit „píše" POST** - `rateLimit(typing:userId, 20/10 s)` + dedup v `setTyping` (broadcast jen při skutečné změně) - proti amplifikaci.
* 🟢 **Heartbeat re-ověření v try/catch** - krátký výpadek DB neshodí spojení do unhandled rejection.
* 🟢 **`connId` generuje server** (ne z query) - vyloučena kolize/přepis cizího spojení.

## Mimo rozsah

E-mailové notifikace (v2), notifikace o schválení požadavku (těžké M8 neděláme), cílení podle role.
