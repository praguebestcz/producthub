# Platforma pro připomínkování HTML specifikací

## Vize produktu

Webová aplikace pro sdílení, připomínkování a rozvoj HTML specifikací.

Platforma je určena pro Product Ownery, UX designéry, vývojáře a klienty, kteří spolupracují nad:

- živými HTML prototypy,
- wireframy,
- komentovanými wireframy,
- funkčními specifikacemi,
- technickými specifikacemi.

Hlavním odlišením produktu je schopnost převést připomínky a diskuse na implementační zadání připravené pro Claude Code.

---

# Hlavní workflow

1. Autor vytvoří projekt.
2. Autor nahraje nebo propojí sadu HTML dokumentů.
3. Autor nasdílí projekt ostatním uživatelům.
4. Recenzenti komentují konkrétní HTML elementy.
5. Nad komentáři probíhá diskuse.
6. Autor převede diskusi na strukturovaný požadavek.
7. Autor požadavek schválí.
8. Systém vytvoří prompt pro Claude Code.
9. Autor prompt zkopíruje nebo vytvoří GitHub úkol.
10. Claude Code provede implementaci.
11. Nová verze je publikována a znovu zkontrolována.

---

# Struktura projektu

Projekt obsahuje více souvisejících HTML dokumentů.

Příklad:

- Rozcestník projektu
- Živý prototyp
- Wireframy
- Komentované wireframy
- Funkční specifikace
- Technická specifikace

Projekt je hlavním objektem systému.

---

# Role

## Autor

Oprávnění:

- vytvářet projekty,
- upravovat projekty,
- spravovat sdílení,
- připojit GitHub repozitář,
- zobrazovat všechny komentáře,
- vytvářet požadavky,
- schvalovat požadavky,
- generovat Claude prompty,
- uzavírat požadavky.

Pouze autor může schválit požadavek k implementaci.

## Komentátor

Oprávnění:

- zobrazovat projekt,
- přidávat komentáře,
- odpovídat na komentáře,
- účastnit se diskusí,
- vytvářet návrhy změn.

Nemůže schvalovat požadavky.

## Čtenář

Oprávnění:

- pouze zobrazovat projekt.

Nemůže komentovat.

---

# Přihlášení

Aplikace využívá Google Login.

Uživatel se musí přihlásit před přidáním komentáře.

---

# Sdílení

MVP obsahuje sdílení pomocí pozvánek a rolí.

Autor může:

- pozvat uživatele pomocí e-mailu,
- nastavit roli,
- odebrat přístup,
- změnit roli.

---

# Komentáře nad HTML elementy

Komentáře musí být navázané na konkrétní HTML element.

Komentáře na úrovni sekce nejsou dostačující.

Ke komentáři se ukládá:

- projekt,
- stránka,
- identifikátor elementu,
- DOM cesta,
- screenshot,
- velikost viewportu,
- autor,
- čas vytvoření.

Preferovaný identifikátor:

```html
<button data-review-id="question-submit">
  Odeslat dotaz
</button>
```

Komentáře by měly být pokud možno zachovány i mezi verzemi dokumentu.

---

# Realtime spolupráce

Více uživatelů může současně připomínkovat stejný projekt.

MVP podporuje:

- živé komentáře,
- živé odpovědi,
- živé změny stavů,
- zobrazení přítomných uživatelů,
- indikaci psaní.

Uživatelé mohou současně komentovat.

Uživatelé nemohou současně upravovat HTML obsah.

---

# Komentářová vlákna

Každé vlákno podporuje:

- odpovědi,
- označení uživatele pomocí @mention,
- otevřený stav,
- vyřešený stav,
- znovu otevřený stav.

---

# Požadavky

Autor může převést diskusi na požadavek.

Požadavek obsahuje:

- název,
- popis,
- dotčený element,
- akceptační kritéria,
- související komentáře,
- související stránky.

Workflow:

Otevřený komentář
→ Návrh požadavku
→ Schváleno
→ Vygenerován Claude prompt
→ Zapracováno
→ Uzavřeno

---

# Integrace Claude Code

Klíčová funkcionalita systému.

Po schválení požadavku:

1. Systém shromáždí kontext.
2. Sestaví strukturovaný prompt.
3. Autor prompt zkontroluje.
4. Autor prompt zkopíruje.
5. Prompt je použit v Claude Code.

Prompt musí obsahovat:

- kontext projektu,
- dotčené soubory,
- HTML kontext,
- popis požadavku,
- akceptační kritéria,
- omezení,
- související diskusi.

---

# Integrace GitHub (součást MVP)

GitHub integrace je součástí MVP.

Funkce:

- připojení repozitáře,
- výběr větve,
- propojení projektu s repozitářem,
- vytvoření implementačního GitHub Issue ze schváleného požadavku.

Budoucí fáze:

- automatické vytvoření větve,
- automatické vytvoření Pull Requestu,
- workflow pro Claude Code.

---

# Interní a veřejné komentáře

Komentáře podporují viditelnost.

## Veřejné

Vidí:

- autor,
- komentátoři.

## Interní

Vidí:

- autor,
- interní tým.

Klient je nevidí.

---

# Notifikace

Uživatelé dostávají notifikace na:

- nový komentář,
- novou odpověď,
- zmínku,
- schválení požadavku,
- uzavření požadavku.

---

# Doporučený technologický stack

Frontend:

- Next.js
- TypeScript
- Tailwind
- shadcn/ui

Backend:

- Next.js API Routes nebo NestJS

Databáze:

- PostgreSQL

ORM:

- Prisma

Realtime:

- Supabase Realtime

Autentizace:

- Google OAuth

Hosting:

- Vercel

Integrace repozitáře:

- GitHub OAuth

---

# Dlouhodobá vize

Převést zpětnou vazbu stakeholderů přímo do AI-assisted vývoje.

Cílový workflow:

Komentář
→ Diskuse
→ Požadavek
→ Schválení
→ Claude Code prompt
→ GitHub úkol
→ Pull Request
→ Review
→ Nasazení

Platforma by měla být mostem mezi produktovou specifikací a AI podporovaným vývojem.
