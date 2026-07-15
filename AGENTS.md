<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ProductHub

Platforma pro sdílení, připomínkování a revizi HTML specifikací. Recenzenti komentují
konkrétní HTML elementy, nad komentáři běží diskuse, autor je převede na strukturovaný
požadavek a systém vygeneruje hotový prompt pro Claude Code.

- **Funkční specifikace (CO aplikace dělá):** `specs/producthub-specifikace.md` — **živý dokument**: po KAŽDÉ úpravě, která mění chování aplikace, aktualizuj dotčené sekce, markery (🟢/🟠) a Revizi; patří do stejného commitu jako změna kódu
- **Design dokument (technické JAK):** `docs/design-2026-07-10-producthub.md` — architektura, milníky, závazné podmínky ze security review
- **Zadání od Hany:** `inputs/claude-code-zadani-cz.md`

## Konvence (zrcadlí aplikaci vratky — `C:\Users\hanao\Desktop\Praguebest\internal\vratky`)

- Next.js 16.2 (App Router, `proxy.ts` místo `middleware.ts`), TypeScript, React 19
- Tailwind 4 + shadcn/ui `base-nova` (Base UI — `render` prop místo `asChild`!), ikony lucide-react, recept `docs/styling.md`
- PostgreSQL 17 + Prisma 6 — lokálně `docker compose up -d` (port 5433!), produkce Railway
- Session: jose JWT cookie (klouzavé obnovení v `proxy.ts`), přihlášení Google OAuth
- Validace: Zod. Testy: vitest v `tests/`. Chyby: Sentry (self-hosted PragueBest)
- České UI texty i komentáře v kódu
- Před změnou DB schématu: review subagentem `.claude/agents/db-security-expert.md`

## Nasazování (závazný workflow)

- **Produkce:** https://producthub-production-0484.up.railway.app (Railway sleduje větev `production`)
- **`main` = vývoj** — commity průběžně; push na GitHub spouští Hana (Claude má push zablokovaný), produkci se NEsahá
- **`production` = produkce** — nasazení VÝHRADNĚ příkazem `git push origin main:production`, který spouští Hana, až výslovně řekne (např. „nasaď"). Claude příkaz jen připraví a pošle jí ho.
- Před předáním push/deploy příkazu Haně: `git log origin/production..main --oneline` (ukázat, co se nasadí)
- Produkční proměnné a redirect URI: viz STAV.md sekce M4

## Bezpečnostní pravidla (závazná, viz user-global CLAUDE.md Hany)

- NIKDY nemazat soubory/data/větve bez výslovného svolení Hany
- NIKDY nepushovat/nedeployovat (GitHub, Railway) bez výslovného svolení Hany
- Každý milník končí ručním testem Hany podle návodu — automatické testy ho nenahrazují
