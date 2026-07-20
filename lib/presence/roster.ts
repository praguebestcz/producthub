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

export type RosterEntry = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  internal: boolean;
  typing: boolean;
};

// Seznam přítomných pro daného příjemce:
//  - bez sebe sama (ukazujeme „ostatní přítomní"),
//  - externí příjemce nevidí interní přítomné,
//  - deduplikace podle userId (jeden uživatel, víc záložek = jednou),
//  - příznak „píše" podle množiny právě píšících (a projde stejným filtrem).
export function computeRoster(
  present: PresentUser[],
  typingUserIds: Set<number>,
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
      typing: typingUserIds.has(u.userId),
    });
  }
  return out;
}
