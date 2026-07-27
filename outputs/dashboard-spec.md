# Přehledový dashboard - Specifikace

**ProductHub (interní aplikace PragueBest) - souhrn + poslední aktivita na úvodní stránce**

## Revize

* **2026-07-27**
  * První návrh (brainstorming s Hanou). Zvolen směr **C** (souhrn + poslední aktivita), všechny 4 dlaždice, feed dle návrhu. - Claude

## Kontext & cíl

Úvodní stránka `/` dnes ukazuje seznam projektů seskupený podle klienta + odznak nevyřešených na kartě. Dashboard přidá **NAD** seznam (1) pruh souhrnu a (2) feed poslední aktivity - rychlý přehled „co se děje" napříč projekty, pro autora i klienta. Obsah respektuje roli a viditelnost interních komentářů.

## Rozsah

### In scope
* **Pruh souhrnu - 4 dlaždice** (napříč projekty, kde je uživatel členem):
  * **Otevřené komentáře** - počet nevyřešených kořenových komentářů, jen viditelné mně (public + interní, pokud jsem interní), **jen nejnovější verze** dokumentů (M9 kopie nezdvojovat).
  * **Čekající zadání** - počet „zadání" (`PromptExport`) se stavem ≠ DONE v projektech, kde jsem **interní**. Dlaždice se NEzobrazí neinternímu uživateli (klient koncept zadání nevidí).
  * **Pro mě** - počet nepřečtených notifikací (stejné číslo jako zvoneček).
  * **Projekty** - počet projektů, kde jsem členem.
* **Feed poslední aktivity** (max ~8 položek, napříč projekty, jen nejnovější verze, viditelnost interních respektována):
  * **nový komentář** (kořen) / **odpověď** / **zmínka** (když jsem v ní zmíněn) - podle `createdAt`.
  * **vyřešení vlákna** - podle `resolvedAt`.
  * Sloučeno a seřazeno sestupně dle času události.
  * Každá položka: avatar + jméno aktéra, akce, projekt › dokument, relativní čas, náhled textu. Klik = proklik na komentář (`/projects/{p}/documents/{d}?comment={rootId}`).

### Out of scope
* Odkazy na logy (logy zatím nejsou), grafy/trendy, filtrování feedu, stránkování feedu.

## Pravidla & validace
* Vše jen pro projekty, kde je uživatel členem.
* Viditelnost: neinterní uživatel NEvidí interní komentáře v počtech ani ve feedu; dlaždice „Čekající zadání" se mu nezobrazí.
* Jen nejnovější verze dokumentu (Prisma `distinct` na `documentId`, nejvyšší `versionNumber`) - kvůli M9 kopiím.
* Feed neobsahuje osobní/citlivá data nad rámec toho, co uživatel stejně vidí v komentářích.

## Akceptační kritéria
* Autor vidí souhrn (4 dlaždice) + feed napříč svými projekty; klient vidí totéž bez interních položek a bez dlaždice „Čekající zadání".
* Počty a feed neduplikují komentáře přenesené M9 (jen nejnovější verze).
* Klik na položku feedu otevře dokument a zvýrazní komentář.
* Prázdné stavy: bez aktivity „Zatím žádná aktivita"; bez projektů zůstává stávající prázdný stav.

## Umístění
Rozšíření stávající stránky `app/page.tsx` (server component) - pruh + feed nad seznamem projektů. Feed jako samostatná server-side funkce (jeden účel, testovatelné počítání odděleně od renderu).
