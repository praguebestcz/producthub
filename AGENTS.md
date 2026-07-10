<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ProductHub

Platforma pro sdílení, připomínkování a revizi HTML specifikací. Recenzenti komentují
konkrétní HTML elementy, nad komentáři běží diskuse, autor je převede na strukturovaný
požadavek a systém vygeneruje hotový prompt pro Claude Code.

- **Design dokument (zdroj pravdy):** `docs/design-2026-07-10-producthub.md`
- **Zadání od Hany:** `inputs/claude-code-zadani-cz.md`

## Konvence (zrcadlí aplikaci vratky — `C:\Users\hanao\Desktop\AI\vratky`)

- Next.js 16.2 (App Router, `proxy.ts` místo `middleware.ts`), TypeScript, React 19
- Tailwind 4 (bez shadcn), ikony lucide-react
- PostgreSQL 17 + Prisma 6 — lokálně `docker compose up -d` (port 5433!), produkce Railway
- Session: jose JWT cookie (klouzavé obnovení v `proxy.ts`), přihlášení Google OAuth
- Validace: Zod. Testy: vitest v `tests/`. Chyby: Sentry (self-hosted PragueBest)
- České UI texty i komentáře v kódu
- Před změnou DB schématu: review subagentem `.claude/agents/db-security-expert.md`

## Bezpečnostní pravidla (závazná, viz user-global CLAUDE.md Hany)

- NIKDY nemazat soubory/data/větve bez výslovného svolení Hany
- NIKDY nepushovat/nedeployovat (GitHub, Railway) bez výslovného svolení Hany
- Každý milník končí ručním testem Hany podle návodu — automatické testy ho nenahrazují
