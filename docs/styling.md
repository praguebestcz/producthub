# Styling ProductHub - referenční dokument

> **Cílová skupina:** každá session, která staví UI ProductHubu. Živá ukázka všeho: stránka `/styleguide` (po přihlášení).
>
> **Původ:** design systém vychází z vratky-app (admin PB styl), ale je záměrně o krok propracovanější - jemné stíny, gradientní akcenty, mikrointerakce. Vratky byly první aplikace; ProductHub je posun dál.

## Principy

1. **Jeden svět** - ProductHub je interní nástroj PB + pozvaní klienti. Jediný design systém (žádné oddělené portály jako u vratek).
2. **Skládej z komponent** - každá obrazovka se skládá z `components/ui/*`. Novou komponentu zakládej, až když se vzor opakuje potřetí (pravidlo 3).
3. **Tokeny, ne napevno psané barvy** - všechny barvy přes Tailwind třídy z tokenů (`text-ink-2`, `bg-bg-card`, `border-line`…). Výjimka: Badge má odstíny napevno (čitelnost ve světlém i tmavém).
4. **Dark mode zdarma** - tokeny se přepínají třídou `.dark` na `<html>` (ThemeToggle, localStorage `ph-theme`). Když stavíš z tokenů, tmavý režim funguje sám.
5. **Mikrointerakce s mírou** - hover zjasnění/stín, `active:translate-y-px` na tlačítkách, animace `ph-animate-*` pro modal/toast. Nic se nehýbe samo od sebe.

## Design tokeny (`app/globals.css` → `@theme`)

**Barvy:**

```
ACCENT (PB)                       INK (text)               BG / LINE
═══════════                       ══════════               ═════════
pb          #DA2A49 hlavní        ink    #0a0a0a hlavní    bg        #fafafa stránka
pb-bright   #FF3057 hover         ink-2  #525252 běžný     bg-card   #ffffff karta
pb-soft     rgba(…,0.06) podklad  ink-3  #737373 popisky   bg-subtle #fafafa zebra
pb-orange   #FF6B35 jen gradient  ink-4  #a3a3a3 placeholder line     #e5e5e5 oddělovače
                                                            line-soft #f0f0f0 jemné
STAVY: success #16a34a · error #dc2626 · warning #d97706
```

**Gradient značky:** `bg-gradient-to-br from-pb to-pb-orange` - POUZE logo dlaždice, avatar fallback a dekorace pozadí loginu (`.ph-login-bg`). Ne na tlačítka a plochy.

**Stíny:** `shadow-[var(--shadow-card)]` karty · `shadow-[var(--shadow-pop)]` vyvýšené (login karta, modal). V tmavém režimu se přepínají samy.

**Radiusy:** karty `rounded-2xl`, pole a tlačítka `rounded-lg`/`rounded-xl`, štítky `rounded-full`.

**Typografie:** Geist (variable, `next/font`), mono Geist Mono. Nadpis stránky 28px bold tracking-tight (PageHeader) · sekce 18px semibold · text 14px `ink-2` · popisky 12px `ink-4`.

## Komponenty (`components/ui/`)

| Komponenta | Použití |
|---|---|
| `Button` | `primary` (červená, 1× na obrazovku), `secondary` (rámeček), `danger` (mazání). `loading` prop. |
| `IconButton` | Akce v řádku tabulky (ikona 15px). |
| `Input`, `Textarea`, `Select`, `Checkbox` | Formuláře - vždy s `label`; chyby přes `error` prop, nápověda `helperText`. |
| `Badge` | Stavy a role: `neutral`/`pb`/`success`/`warning`/`danger`. |
| `Card` | Bílá karta s rámečkem. |
| `Alert` | Hláška v obsahu (`danger`/`info`) - má ikonu i barvu (WCAG). |
| `Toast` | Plovoucí oznámení vpravo nahoře, samo zmizí. |
| `Modal` | Dialog - Esc, klik mimo, mobil = sheet zespodu. |
| `Table`, `Tr`, `Td` | Tabulky se zebra řádky; `<Tr onClick>` = klikatelný řádek s červeným proužkem. |
| `PageHeader` | Nadpis stránky + popis + akce vpravo (+ drobečky). |
| `Logo` | PB ProductHub, `size="md"/"lg"`. |
| `ThemeToggle` | Přepínač světlý/tmavý. |
| `AppHeader` (components/) | Sticky hlavička s blur - logo, admin odkaz, theme, uživatel, odhlášení. |

## Vzory obrazovek

* **Stránka aplikace:** `<AppHeader user>` + `<main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">` + `<PageHeader>` + obsah.
* **Prázdný stav:** karta s `border-dashed`, ikona lucide v kruhu `bg-pb-soft text-pb`, nadpis, 1-2 věty vysvětlení dalšího kroku.
* **Veřejná stránka (login):** `.ph-login-bg` dekorace + vycentrovaná karta `shadow-[var(--shadow-pop)]`.
* **Ikony:** lucide-react, 15-17px v ovládacích prvcích, 26px v prázdných stavech, `strokeWidth` 1.8-2.4.

## Co NEdělat

* Nezavádět nové barvy mimo tokeny (ani Tailwind výchozí `blue-500` apod. - výjimka `Alert info`).
* Nepoužívat gradient na tlačítka, texty a velké plochy.
* Nezakládat variantu komponenty pro jedno použití - nejdřív lokálně, do ui/ až při třetím výskytu.
* Nepsat vlastní tabulky/formuláře, když existuje komponenta.
