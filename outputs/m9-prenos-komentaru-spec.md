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

* **2026-07-30**
  * **v1.1 hotová.** Stupeň 2 (osiřelost potvrzuje běžící stránka) a akce Znovu připnout. Rozhodnutí Hany: osiřelost konzervativně (jen přenesené komentáře) a s automatickým zhojením; připínat smí autor projektu nebo autor komentáře. Bez migrace DB. - Claude
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

### In scope (v1.1, hotovo 2026-07-30)

* **Stupeň 2 - osiřelost potvrzená za běhu.** Prohlížeč po ustálení stránky (klid DOM ~2,5 s, nejdřív ~3 s od načtení) hlásí serveru, které kotvy na stránce našel a které ne. Nenalezená kotva = selektor nevrátil NIC; prvek nalezený, ale skrytý nebo překrytý modalem, se počítá jako NALEZENÝ.
* **Konzervativní zámek proti falešným poplachům.** Za osiřelý se označí JEN komentář **přenesený z předchozí verze** - pozná se podle času vzniku staršího než jeho verze (přenos zachovává původní `createdAt`). Komentář napsaný až v této verzi se neoznačí nikdy, aby odznak neproblikával u prvků uvnitř zavřených modalů.
* **Odznak se sám hojí.** Jakmile se prvek objeví (otevřený modal, dorovnaný obsah), `isOrphaned` padá bez dalších podmínek.
* **Akce Znovu připnout.** Osiřelé vlákno lze přiřadit k jinému prvku: tlačítko u odznaku → jantarový banner → klik na prvek ve specifikaci (Esc ruší). Smí **autor projektu nebo autor komentáře**. Odpovědi se přesunou s kořenem (dědí `pagePath`), i na jinou stránku.

### Out of scope (v2+)

* Přenos vyřešených vláken, reakcí emoji (kopírují se jen vlákna + odpovědi + zmínky).
* Automatické hledání podobného prvku (fuzzy párování kotvy) a e-mail o tom, že komentář osiřel.

## Workflow

1. Autor v dialogu **Nová verze** nahraje soubor/ZIP/URL a nechá zapnutý přepínač „Přenést komentáře" (nebo ho vypne).
2. Server vytvoří novou verzi.
3. **Když je přenos zapnutý:** server najde předchozí verzi, vezme její **nevyřejená** kořenová vlákna + odpovědi a **zkopíruje** je pod novou verzi (v transakci). U každého kořene provede **Stupeň 1** (statické párování kotvy); chybí stránka → `isOrphaned`.
4. Reviewer otevře novou verzi → nevyřešené komentáře jsou tam; špendlíky se připnou u prvků, které se našly (staticky nebo za běhu). Osiřelé (chybí stránka) mají odznak.
5. **Stupeň 2 (v1.1):** po ustálení stránky prohlížeč nahlásí, které kotvy našel. Server přenesené komentáře s chybějícím prvkem označí za osiřelé; ty, jejichž prvek se objevil, zase zhojí.
6. Autor projektu může osiřelé vlákno **znovu připnout** k jinému prvku.
7. Do starších verzí už nelze psát (read-only).

## Datový model

**Beze změny schématu.** Používá se `Comment.documentVersionId` (kopie dostane id nové verze) a `Comment.isOrphaned` (Stupeň 1 u chybějící stránky, Stupeň 2 za běhu, znovu připnutí ho ruší). Migrace NENÍ potřeba.

## Pravidla & validace

* Kopírují se jen vlákna se stavem **OPEN / REOPENED** (nevyřešená). Vyřešená zůstanou na staré verzi.
* Kopie zachová autora, čas vzniku, viditelnost (PUBLIC/INTERNAL), stav, kotvu (dataReviewId/domPath/elementHtml), zmínky. Reakce emoji se nekopírují.
* **Read-only starší verze:** POST komentáře / PATCH stavu / PATCH kotvy ověří, že `documentVersionId` = nejvyšší `versionNumber` dokumentu; jinak 409.
* Přenos i migrace kotev běží JEN když je přepínač zapnutý.
* Kopírování je atomické (transakce); při chybě se nová verze vytvoří, ale bez přenosu (nezablokuje upload) - s hláškou.

### Stupeň 2 - hlášení kotev (v1.1)

* Hlásit smí každý, kdo dokument vidí (READER+) - jde o technický příznak, ne o obsah.
* Server přijímá hlášení **jen pro nejnovější verzi**; pro starší je to tichý no-op (jsou read-only).
* Dotčené komentáře se načtou přes sdílený filtr viditelnosti - neinterní člen tedy NEMŮŽE přepnout příznak interního vlákna ani se dozvědět, že existuje.
* Označit za osiřelý lze jen komentář **starší než jeho verze** (= přenesený) a jen když osiřelý ještě není.
* Zhojit lze kterýkoli osiřelý komentář, jehož prvek se našel.
* Rate-limit 60 hlášení / min na uživatele; stejný výsledek prohlížeč neposílá dvakrát.
* Po změně jde SSE signál, takže odznak dojede i ostatním s otevřeným dokumentem.

### Znovu připnutí (v1.1)

* Smí **autor projektu** nebo **autor komentáře**; ostatní dostanou 403 (interní vlákno bez práva = 404, existence se neprozrazuje).
* Jen **kořen vlákna** (odpověď vlastní kotvu nemá) a jen v nejnovější verzi.
* Povinná aspoň jedna kotva (`dataReviewId` nebo `domPath`); limity délek stejné jako u vzniku komentáře.
* Cílový prvek už nese jiné vlákno téže verze → 409 (jeden prvek = jedno vlákno).
* Uložení je atomické: kořen dostane novou kotvu, stránku a `isOrphaned = false`, odpovědi se přerovnají na stejnou stránku.

## Akceptační kritéria

* Nahrání nové verze s přenosem: nevyřešená vlákna se objeví v nové verzi; vyřešená ne.
* Prvek se stejným `data-review-id` (i posunutý) → komentář se připne.
* Stránka v nové verzi chybí → komentář je osiřelý (odznak), bez špendlíku.
* Stará verze pořád zobrazí své původní špendlíky.
* Do starší verze nejde přidat komentář/odpověď/změnu stavu (409).
* Přepínač vypnutý → nová verze začne bez komentářů; staré zůstanou na staré verzi.
* **v1.1:** přenesený komentář, jehož prvek v nové verzi není, dostane odznak do několika sekund po otevření stránky.
* **v1.1:** komentář napsaný až v aktuální verzi odznak nedostane, ani když jeho prvek žije uvnitř zavřeného modalu.
* **v1.1:** po otevření modalu s dotyčným prvkem odznak sám zmizí.
* **v1.1:** Znovu připnout přiřadí vlákno k vybranému prvku, odznak zmizí a špendlík naskočí; u cizího komentáře akci nevidí nikdo kromě autora projektu.

## Edge casy

* Dokument má jen 1 verzi (žádná předchozí) → není co přenášet.
* Předchozí verze nemá žádná nevyřešená vlákna → nic se nekopíruje.
* Nová verze nemá HTML dané stránky → všechna vlákna té stránky osiřelá.
* Vlákno bez kotvy (obecné) → zkopíruje se, špendlík nemá tak jako tak.
* Prohlížeč hlásí kotvu jako chybějící i nalezenou zároveň (souběh) → neoznačí se za osiřelou.
* Znovu připnutí na prvek na JINÉ stránce → přesune se i celá diskuse pod vláknem.
* Selhání hlášení kotev (síť, 429) → tiše se ignoruje, prohlížení specifikace to nesmí rušit.

## Mimo rozsah

Přenos vyřešených vláken a reakcí, fuzzy hledání náhradního prvku, e-mailová upozornění na přenos i na osiřelost.
