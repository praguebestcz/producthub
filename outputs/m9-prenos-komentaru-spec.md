# M9 - Přenos komentářů mezi verzemi - Specifikace

**ProductHub (interní aplikace PragueBest) - komentáře přežijí nahrání nové verze specifikace**

## Legenda markerů

| Marker | Význam |
|--------|--------|
| 🟢 | Hotovo / nasazeno |
| 🟠 | Plánováno / k upřesnění |
| 🔴 | Blokováno / vyžaduje rozhodnutí |
| ⚠️ | Riziko / poznámka |

## Revize

* **2026-07-22**
  * První návrh. Rozhodnutí Hany: přenášet **jen nevyřešené** komentáře; staré verze **read-only**; osiřelý komentář jen **ukázat s odznakem** (akce „znovu připnout" až v1.1). - Claude

## Související dokumenty

* Hlavní specifikace: `specs/producthub-specifikace.md`
* Design dokument: `docs/design-2026-07-10-producthub.md` (M9, dvoustupňová migrace kotev)
* Kotvy a overlay: `public/overlay.js`, `lib/comments/visibility.ts`

## Kontext & cíl

Reálné specifikace se během revize **re-uploadují** (nová verze prototypu). Dnes jsou komentáře pevně navázané na verzi, ve které vznikly - po nahrání nové verze ji reviewer vidí **bez komentářů** (zůstaly na staré verzi). M9 zajistí, že **nevyřešená zpětná vazba se přenese** na novou verzi a připne se na stejné prvky.

**Cíl:** Po nahrání nové verze (s přenosem) se nevyřešené komentáře objeví u odpovídajících prvků nové verze; stará verze zůstane jako historie.

## Rozsah

### In scope (v1)

* Přepínač **„Přenést komentáře z předchozí verze"** v dialogu Nová verze (default zapnuto).
* Přenos = **kopie** nevyřešených vláken (status OPEN/REOPENED) + jejich odpovědí do nové verze. Stará verze si komentáře **nechá** (historie, read-only).
* **Stupeň 1 - server (při uploadu):** ověří, že **stránka** komentáře (`pagePath`) v nové verzi existuje. Chybí → `isOrphaned`. Připnutí na KONKRÉTNÍ prvek řeší prohlížeč za běhu (overlay `data-review-id` → `domPath`, včetně JS-generovaných prvků); statické párování prvku na serveru je bez Stupně 2 zbytečné (design doc ho stejně za osiřelý neoznačuje), proto ho v1 vynecháváme.
* **Staré verze read-only** - komentář/odpověď/změna stavu jde jen v NEJNOVĚJŠÍ verzi dokumentu (vynuceno na serveru: 409, když cílová verze není nejvyšší).
* Osiřelý komentář (chybí stránka) → odznak **„prvek už neexistuje"** v panelu, bez špendlíku (UI už existuje z M6).

### Out of scope (v1.1+)

* **Stupeň 2 - autoritativní osiřelost za běhu** (overlay hlásí nepřipnuté kotvy). Riziko falešných pozitiv u klikacích prototypů (prvek za neotevřeným modalem vzniká až JS). Zatím: nepřipnutý špendlík se jen skryje, komentář zůstane v panelu s náhledem prvku.
* **Akce „znovu připnout"** - ruční přiřazení osiřelého komentáře k jinému prvku.
* Přenos vyřešených vláken, reakcí emoji (kopírují se jen vlákna + odpovědi + zmínky).

## Workflow

1. Autor v dialogu **Nová verze** nahraje soubor/ZIP/URL a nechá zapnutý přepínač „Přenést komentáře" (nebo ho vypne).
2. Server vytvoří novou verzi.
3. **Když je přenos zapnutý:** server najde předchozí verzi, vezme její **nevyřejená** kořenová vlákna + odpovědi a **zkopíruje** je pod novou verzi (v transakci). U každého kořene provede **Stupeň 1** (statické párování kotvy); chybí stránka → `isOrphaned`.
4. Reviewer otevře novou verzi → nevyřešené komentáře jsou tam; špendlíky se připnou u prvků, které se našly (staticky nebo za běhu). Osiřelé (chybí stránka) mají odznak.
5. Do starších verzí už nelze psát (read-only).

## Datový model

**Beze změny schématu.** Používá se `Comment.documentVersionId` (kopie dostane id nové verze) a `Comment.isOrphaned` (Stupeň 1 u chybějící stránky). Migrace NENÍ potřeba.

## Pravidla & validace

* Kopírují se jen vlákna se stavem **OPEN / REOPENED** (nevyřešená). Vyřešená zůstanou na staré verzi.
* Kopie zachová autora, čas vzniku, viditelnost (PUBLIC/INTERNAL), stav, kotvu (dataReviewId/domPath/elementHtml), zmínky. Reakce emoji se nekopírují.
* **Read-only starší verze:** POST komentáře / PATCH stavu ověří, že `documentVersionId` = nejvyšší `versionNumber` dokumentu; jinak 409.
* Přenos i migrace kotev běží JEN když je přepínač zapnutý.
* Kopírování je atomické (transakce); při chybě se nová verze vytvoří, ale bez přenosu (nezablokuje upload) - s hláškou.

## Akceptační kritéria

* Nahrání nové verze s přenosem: nevyřešená vlákna se objeví v nové verzi; vyřešená ne.
* Prvek se stejným `data-review-id` (i posunutý) → komentář se připne.
* Stránka v nové verzi chybí → komentář je osiřelý (odznak), bez špendlíku.
* Stará verze pořád zobrazí své původní špendlíky.
* Do starší verze nejde přidat komentář/odpověď/změnu stavu (409).
* Přepínač vypnutý → nová verze začne bez komentářů; staré zůstanou na staré verzi.

## Edge casy

* Dokument má jen 1 verzi (žádná předchozí) → není co přenášet.
* Předchozí verze nemá žádná nevyřešená vlákna → nic se nekopíruje.
* Nová verze nemá HTML dané stránky → všechna vlákna té stránky osiřelá.
* Vlákno bez kotvy (obecné) → zkopíruje se, špendlík nemá tak jako tak.

## Mimo rozsah

Stupeň 2 (runtime osiřelost), „znovu připnout", přenos vyřešených/reakcí, e-mailová upozornění na přenos.
