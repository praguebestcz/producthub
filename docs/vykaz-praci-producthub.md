# Výkaz prací - ProductHub

## Shrnutí

Vývoj interní platformy ProductHub (připomínkování a revize HTML specifikací).
Celkem **cca 12 hodin** práce ve **3 dnech** (10., 11. a 13. 7. 2026).
Aplikace je nasazená v produkci na Railway a zálohovaná na GitHubu.

Časy jsou orientační, odvozené z časových značek commitů v gitu (okamžik uložení
práce); u úvodního brainstormingu je začátek odhadnutý (proběhl před prvním commitem).

## Po dnech

### 10. 7. 2026 (večer-noc) - cca 7 hodin

| Blok | Co vzniklo | Čas |
|------|-----------|-----|
| Brainstorming + návrh | Analýza zadání, návrh architektury, plán milníků, design dokument | ~1,5 h |
| M0 - Kostra | Next.js 16, Tailwind 4, PostgreSQL v Dockeru, testy, Sentry | ~0,5 h |
| M1 - Databáze | Návrh schématu (12 tabulek) + bezpečnostní review + migrace | ~1,5 h |
| M2 + design systém | Google přihlášení, session; migrace na shadcn/ui, tmavý režim, 20+ komponent, styleguide | ~2 h |
| M3 - Projekty | Projekty, členové, pozvánky, role, boční menu | ~1 h |
| M3.5 - Klienti | Složky klientů, seskupený dashboard, README | ~0,5 h |

### 11. 7. 2026 (ráno) - cca 0,5 hodiny

| Blok | Co vzniklo | Čas |
|------|-----------|-----|
| Oprava UI | Výběr klienta a rolí zobrazoval technické hodnoty místo názvů | ~0,5 h |

### 13. 7. 2026 - cca 4,5 hodiny

| Blok | Co vzniklo | Čas |
|------|-----------|-----|
| M4 - Nasazení | Railway (server + databáze), produkční Google login, řešení výpadků (port, adresa), favicon, nasazovací workflow | ~2,5 h |
| M4.5 - Deaktivace | Vypnutí účtu bez ztráty dat + bezpečnostní review | ~1 h |
| M4.5 - Mazání | Smazání prázdných účtů + bezpečnostní review | ~1 h |

## Co je hotové (funkce v produkci)

* Přihlášení přes Google (bez hesel), správa přístupu (admin / tým / role v projektu)
* Projekty s dokumenty a členy, pozvánky e-mailem, role Autor / Komentátor / Čtenář
* Interní vs. veřejné rozlišení členů (příprava na oddělení klienta od týmu)
* Složky klientů (DDS, Foto Škoda, … i PragueBest), seskupený přehled projektů
* Správa uživatelů: právo zakládat projekty, deaktivace a mazání účtů
* Design systém (shadcn/ui + PB branding), světlý/tmavý režim, sbalitelné menu
* Nasazení na Railway s workflow „main = vývoj, production = vědomé nasazení"

## Co zbývá (další milníky)

* **M5** - nahrávání specifikací (HTML / ZIP / import z URL) a prohlížeč s verzemi
* **M6** - komentáře nad konkrétními HTML elementy a diskusní vlákna
* **M7** - živá spolupráce (realtime) + notifikace
* **M8** - převod diskuse na požadavek + generování promptu pro Claude Code
* **M9** - přenos komentářů mezi verzemi dokumentu, dokončení
* Backlog: e-mailové notifikace, aplikační logy, mapování projekt ↔ GitLab repozitář

## Poznámka k metodice a kvalitě

* Každá změna databázového schématu prošla **bezpečnostním review** (samostatný
  expert), než se aplikovala - podle bezpečnostních pravidel projektu.
* Každý milník je uzavřený automatickými testy (24 testů) + ruční kontrolou.
* Veškerá práce je verzovaná v gitu; historii lze dohledat příkazem `git log`.
