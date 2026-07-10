# Styling ProductHub - referenční dokument

> **Cílová skupina:** každá session, která staví UI ProductHubu. Živá ukázka všeho: stránka `/styleguide` (po přihlášení).
>
> **Základ: shadcn/ui** (styl `base-nova`, primitivy Base UI) - aktuální standard pro moderní aplikace. Komponenty NEJSOU knihovna, jsou zkopírované přímo v `components/ui/` (malá písmena, např. `button.tsx`) - lze je libovolně upravovat. Přidání další: `npx shadcn@latest add <název>`.

## Principy

1. **Skládej ze shadcn komponent** - žádné vlastní `<button>`, `<input>`, `<select>`, vlastní tabulky ani modaly. Když komponenta chybí, nejdřív `npx shadcn@latest add`, teprve pak vlastní tvorba.
2. **Tokeny, ne napevno psané barvy** - `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`(výchozí u `border`), `ring-ring`. PB značka: `--primary` = PB červená (automaticky v Button, Badge, Switch…).
3. **Dark mode zdarma** - next-themes přepíná `.dark` na `<html>` (ThemeToggle v hlavičce). Stavíš-li z tokenů, tmavý režim funguje sám.
4. **Destruktivní akce = AlertDialog** (ne Dialog) - mazání vždy s výslovným potvrzením.
5. **Toasty přes sonner** - `import { toast } from "sonner"` → `toast.success("…")` / `toast.error("…")`. `<Toaster>` je v layoutu.
6. **Jedna hustota na stránku** - `gap-6 / p-6 / text-sm` (komfortní). Ikony lucide 16px (`size-4`) v ovládacích prvcích.

## Tokeny a brand

* **`--primary`** = PB červená `#da2a49` (dark: `#ff3057`), `--ring` sladěný. Neutrály = shadcn `neutral` (oklch).
* **Navíc k shadcn:** `--color-pb`, `--color-pb-bright`, `--color-pb-soft`, `--color-pb-orange`, `--color-success`, `--color-warning`.
* **Gradient značky** `bg-gradient-to-br from-pb to-pb-orange` - POUZE logo dlaždice a fallback avatarů. Ne tlačítka, ne plochy.
* **`.ph-login-bg`** - dekorativní záře na loginu. **`--shadow-pop`** - vyvýšená karta (login).
* **Fonty:** Geist / Geist Mono přes `next/font`. POZOR (past): v `@theme inline` musí být literální názvy `"Geist", "Geist Fallback"` - runtime proměnné next/fontu se tam nevyhodnotí.

## Komponenty

**shadcn (`components/ui/`, malá písmena):** button (variant: default/outline/secondary/ghost/destructive; size icon pro ikonová tlačítka), input, textarea, label, select, checkbox, switch, badge, card, alert, table, dialog, alert-dialog, dropdown-menu, avatar, tooltip, tabs, separator, skeleton, sheet, sonner.

* **Base UI idiom:** místo Radix `asChild` se používá **`render` prop**: `<DialogTrigger render={<Button variant="outline" />}>` nebo `<DropdownMenuItem render={<Link href="…" />}>`.
* Odkaz vypadající jako tlačítko: `className={cn(buttonVariants({ variant, size }))}` na `<a>`/`<Link>`.

**Vlastní (`components/`):** `ui/Logo.tsx` (ProductHub, size md/lg), `ui/ThemeToggle.tsx` (next-themes), `ui/PageHeader.tsx` (nadpis stránky + popis + akce), `app-header.tsx` (sticky hlavička s blur), `user-menu.tsx` (avatar dropdown s odhlášením).

**`components/legacy/`** - původní ruční komponenty před migrací na shadcn. NEPOUŽÍVAT; čekají na schválení smazání.

## Vzory obrazovek

* **Stránka aplikace:** `<AppHeader user>` + `<main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">` + `<PageHeader>` + obsah.
* **Prázdný stav:** `<Card className="border-dashed">`, ikona lucide v kruhu `bg-pb-soft text-pb`, nadpis, 1-2 věty vysvětlení dalšího kroku.
* **Tabulka:** shadcn Table v `<div className="rounded-xl border">`.
* **Formulář:** `<Label>` + prvek + nápověda `text-xs text-muted-foreground`; chyba = `aria-invalid` + `text-destructive`.
* **Stavové štítky:** `<Badge className="bg-success/15 text-success">Vyřešeno</Badge>`, `bg-warning/15 text-warning` pro čekající.
* **Veřejná stránka (login):** `.ph-login-bg` + vycentrovaná `<Card className="shadow-[var(--shadow-pop)]">`.

## Co NEdělat

* Nezavádět nové barvy mimo tokeny; žádné `blue-500` apod.
* Nepoužívat gradient na tlačítka, texty a velké plochy.
* Nepřepisovat shadcn komponenty „na vlastní pěst" - úpravy dělat uvnitř `components/ui/*.tsx` (patří nám), ale střídmě a s komentářem.
* Nepoužívat Dialog na potvrzení mazání (patří AlertDialog).
* Nemíchat hustoty a radiusy; držet `--radius` systém.
