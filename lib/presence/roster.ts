// Přítomnost u dokumentu (M7 Fáze 2) - výpočet seznamu přítomných PRO KONKRÉTNÍHO
// příjemce. Bezpečnostní jádro: EXTERNÍ (neinterní) člen NESMÍ vidět, že je
// přítomen INTERNÍ člen ani jeho aktivitu; INTERNÍ vidí všechny. Čistá funkce
// (testovatelná bez SSE) - filtr se aplikuje na SERVERU per příjemce, nikdy se
// neposílá plný seznam a nefiltruje na klientovi.

export type PresentUser = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  // internal = člen týmu PB (canSeeInternal). Externí ho nesmí vidět.
  internal: boolean;
};

// Kde uživatel právě píše: stránka + prvek/vlákno. threadId = odpověď v
// existujícím vláknu; dataReviewId/domPath = prvek nového komentáře.
export type TypingInfo = {
  pagePath: string;
  threadId: number | null;
  dataReviewId: string | null;
  domPath: string | null;
};

export type RosterEntry = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  internal: boolean;
  // null = nepíše; jinak kde píše (pro živou značku u prvku / vlákna).
  typing: TypingInfo | null;
};

// Seznam přítomných pro daného příjemce:
//  - bez sebe sama (ukazujeme „ostatní přítomní"),
//  - externí příjemce nevidí interní přítomné,
//  - deduplikace podle userId (jeden uživatel, víc záložek = jednou),
//  - „píše" (i s umístěním) projde stejným filtrem viditelnosti.
export function computeRoster(
  present: PresentUser[],
  typing: Map<number, TypingInfo>,
  recipient: { userId: number; canSeeInternal: boolean },
): RosterEntry[] {
  const seen = new Set<number>();
  const out: RosterEntry[] = [];
  for (const u of present) {
    if (u.userId === recipient.userId) continue; // ne sám sebe
    if (u.internal && !recipient.canSeeInternal) continue; // externí nevidí interní
    if (seen.has(u.userId)) continue; // dedup (víc spojení/záložek)
    seen.add(u.userId);
    out.push({
      userId: u.userId,
      name: u.name,
      avatarUrl: u.avatarUrl,
      internal: u.internal,
      typing: typing.get(u.userId) ?? null,
    });
  }
  return out;
}
