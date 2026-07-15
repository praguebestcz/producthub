// @zmínky — čistý helper (testovatelný bez DB).
// Security review (M6): zmínit lze JEN členy projektu, jinak by šla zjistit
// existence projektu (a doručit notifikace) nečlenovi.

// Vrátí požadovaná userId, která NEJSOU mezi členy projektu (deduplikovaně).
export function invalidMentionIds(
  requested: number[],
  memberUserIds: number[],
): number[] {
  const members = new Set(memberUserIds);
  return [...new Set(requested)].filter((id) => !members.has(id));
}
