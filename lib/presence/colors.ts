// Stabilní barva uživatele (podle userId) — aby se přítomní odlišili (avatar
// u prvku, kroužek v liště). Pevná paleta = předvídatelné, přístupné barvy;
// stejný uživatel má vždy stejnou barvu napříč aplikací.
const PALETTE = [
  "#2563eb", // modrá
  "#dc2626", // červená
  "#059669", // zelená
  "#d97706", // oranžová
  "#7c3aed", // fialová
  "#db2777", // růžová
  "#0891b2", // tyrkysová
  "#ca8a04", // zlatá
];

export function userColor(userId: number): string {
  const i = ((userId % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i];
}
