# AI nastavení a náklady - Specifikace

**ProductHub (interní aplikace PragueBest) - admin nastavení Anthropic API klíče, měsíční limit tvorby AI promptů a přehled spotřeby/ceny**

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
  * **Změna (Hana):** limit z „počtu generování za měsíc" → **měsíční rozpočet v USD** (logičtější - limituje přímo náklady). `AppConfig.monthlyGenerationLimit` → `monthlyBudgetUsdCents` (rename migrace, řádek zachován); kontrola porovnává utracený odhad ceny za měsíc s rozpočtem. Admin zadává v dolarech. `isOverLimit` → `isOverBudget` - Hana Ortmannová, Claude
  * **Implementováno.** Bezpečnostní revize `db-security-expert` (SCHVÁLENO S VÝHRADAMI) zapracována: index na `AiUsage.userId`, CHECK `id=1` u `AppConfig`, CHECK na nezáporné tokeny/limit, seed řádku; šifrování klíče přes **samostatnou `SECRET_ENC_KEY`** (ne z JWT_SECRET), AES-256-GCM, formát `v1:iv:tag:ct`, klíč se dešifruje jen server-side a nikdy se nevrací klientovi. Tabulky `AppConfig`+`AiUsage`, `lib/crypto/secret.ts`, `lib/ai/config.ts`, admin stránka `/admin/ai` + API, napojení do generate route (limit + log spotřeby). Ověřeno: stránka, uložení limitu, logování (1 generování → počet/tokeny/cena), env klíč. Vyžaduje `SECRET_ENC_KEY` (nastaví Hana) pro klíč v aplikaci - Hana Ortmannová, Claude
  * První návrh podle rozhodnutí Hany: klíč v **admin nastavení** (šifrovaně v DB), limit = **počet generování za měsíc**, rozsah = **celá aplikace**. Detailní schéma k `db-security-expert` review - Hana Ortmannová (rozhodnutí), Claude (sepsání)

## Související dokumenty

* Funkce M8 (generování promptů): `outputs/m8-prompt-z-komentaru-spec.md`
* Hlavní specifikace: `specs/producthub-specifikace.md`

> ⚠️ **Bezpečnostní revize:** Nové tabulky i způsob šifrování klíče projdou revizí `db-security-expert` PŘED migrací. Schématu se nedotýkáme, dokud Hana nedá výslovné „ano" k databázi.

## Kontext & cíl

M8 generuje prompty přes Claude (Anthropic API). Dnes je klíč jen v env proměnné a limit je pevný rate-limit. Chybí: (1) změnit klíč bez nasazení, (2) hlídat, kolik se generuje (náklady), (3) vidět, kolik to stálo.

**Cíl:** admin (Hana) v aplikaci nastaví Anthropic klíč a měsíční limit počtu generování; aplikace hlídá limit a ukazuje přehled spotřeby a odhad ceny.

## Rozhodnutí (potvrzeno Hanou)

* **Klíč:** v **admin nastavení** aplikace, uložený **šifrovaně** v DB. Přebíjí env proměnnou. Když není nastavený, použije se env.
* **Limit:** **počet generování za kalendářní měsíc** (0 = bez limitu).
* **Rozsah:** **celá aplikace** (jeden společný limit i jeden přehled).

## Rozsah

**In scope:**

* Admin stránka „AI nastavení" (jen `isAdmin`): API klíč, měsíční limit, přehled spotřeby.
* Uložení klíče šifrovaně; v UI jen `sk-ant-…poslední4` + zdroj (nastaveno v aplikaci / z env).
* Kontrola limitu před generováním (překročeno → generování se nespustí, srozumitelná hláška).
* Log každého generování (tokeny, model, kdy, kdo, projekt) → přehled: počet za měsíc vs limit + odhad ceny.

**Out of scope (později):**

* Limit/přehled per projekt (teď app-wide).
* Rozpočet v penězích jako limit (teď jen počet).
* Výběr modelu v UI, více klíčů, upozornění e-mailem při blížícím se limitu.

## Workflow

1. Admin otevře „AI nastavení" (v adminu).
2. Zadá Anthropic API klíč → uloží se šifrovaně; v UI se ukáže jen `sk-ant-…1234` + „nastaveno v aplikaci".
3. Zadá měsíční limit generování (např. 200; 0 = bez limitu).
4. Uživatel generuje prompt (M8):
   * Server zkontroluje limit: počet generování v aktuálním měsíci < limit (nebo limit = 0).
     * **Pod limitem** → zavolá Claude (klíč z DB, jinak env), zaloguje spotřebu (tokeny), vrátí prompt.
     * **Přes limit** → generování se NEspustí, hláška „Vyčerpán měsíční limit generování (N). Zvyšte ho v AI nastavení."
5. Admin v „AI nastavení" vidí: počet generování tento měsíc vs limit + odhad ceny + posledních pár generování.

## Obrazovka: AI nastavení (admin)

* **API klíč:** stav (`nastaveno v aplikaci · sk-ant-…1234` / `z env` / `nenastaveno`), pole pro nový klíč (uložit), tlačítko „Smazat klíč z aplikace" (vrátí se na env).
* **Měsíční limit generování:** číslo (0 = bez limitu), uložit.
* **Přehled tento měsíc:** počet generování / limit, odhad ceny (Kč/$), tabulka posledních generování (kdy, kdo, projekt, tokeny, odhad ceny).

## Datový model (návrh k revizi)

```prisma
// Jednořádková konfigurace aplikace (id vždy 1). Drží AI nastavení.
model AppConfig {
  id                     Int      @id @default(1)
  // Anthropic API klíč ŠIFROVANĚ (AES-256-GCM). Nikdy se nevrací klientovi
  // (v UI jen last4). Prázdné = použije se env ANTHROPIC_API_KEY.
  anthropicApiKeyEnc     String?  @db.Text
  anthropicApiKeyLast4   String?  @db.VarChar(8)
  // Měsíční limit počtu AI generování (0 = bez limitu).
  monthlyGenerationLimit Int      @default(0)
  updatedAt              DateTime @updatedAt
}

// Log každého AI generování — pro měsíční limit i přehled spotřeby/ceny.
model AiUsage {
  id           Int      @id @default(autoincrement())
  // Kontext (informativní); projekt/uživatel zaniká nezávisle na logu.
  projectId    Int?
  project      Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  userId       Int?
  user         User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  model        String   @db.VarChar(64)
  inputTokens  Int
  outputTokens Int
  createdAt    DateTime @default(now())

  @@index([createdAt])
  @@index([projectId])
}
```

### Šifrování klíče (návrh k revizi)

* AES-256-GCM. Šifrovací klíč **odvozený z `JWT_SECRET`** (HKDF, samostatný label „producthub-ai-key-enc") - není potřeba nová env proměnná; při úniku DB je klíč bez `JWT_SECRET` nepoužitelný.
* Ukládá se `iv:authTag:ciphertext` (base64) v `anthropicApiKeyEnc`. `anthropicApiKeyLast4` slouží jen k zobrazení.
* Dešifruje se jen server-side v okamžiku volání Claude. Klíč se NIKDY neposílá klientovi.
* — TODO(Dev): posoudit odvození z `JWT_SECRET` vs. samostatná `SECRET_ENC_KEY` (revize).

## Pravidla & validace

* „AI nastavení" a jeho API (GET/PATCH) jsou **jen pro `isAdmin`** (jinak 404/403).
* Odpovědi API **nikdy** nevrací dešifrovaný klíč - jen `last4` a zdroj.
* Limit se počítá z `AiUsage` za aktuální kalendářní měsíc; `0` = bez limitu.
* Spotřeba se loguje jen při **úspěšném** volání Claude (neúspěch se nepočítá do limitu).
* Odhad ceny = tokeny × cena za token (konstanty v kódu). — TODO(Dev): ověřit aktuální ceník `claude-sonnet-5`; cena je odhad.

## Akceptační kritéria

* Admin nastaví klíč → generování používá klíč z DB; v UI je vidět jen `sk-ant-…1234`, plný klíč se nikde nevrací.
* Admin smaže klíč → generování se vrátí na env klíč.
* Při dosažení měsíčního limitu se generování nespustí a vrátí srozumitelnou hlášku; při `0` limit neplatí.
* Přehled ukazuje počet generování tento měsíc vs limit + odhad ceny.
* Neadmin se na „AI nastavení" ani jeho API nedostane.

## Edge casy

* **Klíč v DB i env:** přednost má DB. Když je DB klíč smazán, použije se env.
* **Žádný klíč (DB ani env):** generování vrátí stávající hlášku o chybějícím klíči (503).
* **Limit 0:** bez omezení.
* **Změna limitu dolů pod aktuální spotřebu:** další generování se zastaví, už proběhlá zůstávají.
* **Smazaný projekt/uživatel:** `AiUsage` zůstává (SetNull) - přehled ceny se neztratí.

## Mimo rozsah

Viz [Rozsah → Out of scope](#rozsah). Per-projekt limit/přehled, rozpočet v penězích, výběr modelu a e-mailová upozornění jsou vědomě odložené.
