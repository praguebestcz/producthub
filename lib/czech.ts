// České skloňování počtů: 1 dokument, 2-4 dokumenty, 0 a 5+ dokumentů.
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
