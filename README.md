# ProductHub

Platforma pro sdílení, připomínkování a revizi HTML specifikací (PragueBest).

Recenzenti komentují konkrétní HTML elementy živých prototypů a wireframů,
nad komentáři běží diskuse a autor je převede na strukturovaný požadavek.
Systém z požadavku vygeneruje hotový implementační prompt pro Claude Code.

## Stack

* **Next.js 16** (App Router, Turbopack) + TypeScript + React 19
* **PostgreSQL 17** + Prisma 6 (lokálně Docker, produkce Railway)
* **Tailwind 4** + shadcn/ui (styl base-nova, Base UI primitivy)
* Přihlášení: **Google OAuth** (jose JWT session, žádná hesla)
* Testy: vitest · Chyby: Sentry · Validace: Zod

## Lokální spuštění

Předpoklady: Node.js 20+, Docker Desktop.

```
# 1. Závislosti
npm install

# 2. Prostředí — zkopíruj šablonu a doplň hodnoty podle komentářů v ní
#    (DB heslo, JWT secret, Google OAuth klient — návod v .env.example)
cp .env.example .env

# 3. Databáze (PostgreSQL v Dockeru, port 5433)
docker compose up -d

# 4. Migrace schématu
npx prisma migrate dev

# 5. Vývojový server
npm run dev
```

Aplikace běží na `http://localhost:3000`. První přihlášený e-mail uvedený
v `ADMIN_EMAILS` dostane admin práva a právo zakládat projekty.

## Užitečné příkazy

| Příkaz | Co dělá |
|---|---|
| `npm test` | Testy (vitest) |
| `npm run typecheck` | Kontrola typů |
| `npm run lint` | ESLint |
| `npx prisma studio` | Vizuální prohlížečka databáze |
| `npx prisma migrate dev` | Aplikace migrací (po změně schématu) |

> Po každé migraci restartuj dev server — drží starý Prisma klient v paměti.

## Struktura

```
app/           stránky a API routes (App Router)
components/    React komponenty (ui/ = shadcn + vlastní)
lib/           sdílená logika (auth, prisma, validace, …)
prisma/        schéma DB + migrace
docs/          design dokument a styling recept
tests/         vitest testy
```

* **Design dokument (zdroj pravdy):** `docs/design-2026-07-10-producthub.md`
* **Design systém / styleguide:** `docs/styling.md` + živě na `/styleguide`
* Před změnou DB schématu je povinné review subagentem
  `.claude/agents/db-security-expert.md`

## Stav (milníky)

* ✅ M0 kostra · M1 DB schéma (security review) · M2 Google přihlášení
  · M2.5 design systém · M3 projekty, členové, pozvánky · M3.5 složky klientů
* 🔜 M4 nasazení (Railway) · M5 dokumenty + prohlížeč specifikací
  · M6 komentáře nad elementy · M7 realtime + notifikace
  · M8 požadavky + Claude prompty · M9 verze dokumentů

Interní nástroj PragueBest s.r.o.
