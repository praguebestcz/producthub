// Osiřelost kotev — Stupeň 2 (M9 v1.1). Server při uploadu ověří jen existenci
// STRÁNKY (Stupeň 1, lib/documents/comment-transfer.ts); jestli na ní existuje
// i konkrétní PRVEK, pozná až prohlížeč za běhu (klikací prototypy tvoří prvky
// JavaScriptem, statická analýza je nevidí). Overlay proto po ustálení DOM
// hlásí, které kotvy se našly a které ne — a tahle funkce z toho spočítá, co
// se smí zapsat.
//
// Konzervativní zámek (rozhodnutí Hany 2026-07-30): za osiřelý se smí označit
// JEN komentář PŘENESENÝ z předchozí verze. Poznáme ho podle času vzniku —
// přenos zachovává původní `createdAt` (comment-transfer.ts), takže přenesený
// komentář je STARŠÍ než verze, ve které leží. Komentář napsaný až v téhle
// verzi je vždy mladší, a proto ho nikdy neoznačíme (jeho prvek tam
// prokazatelně byl; kdyby zrovna žil uvnitř zavřeného modalu, odznak by jen
// planě problikával).
//
// Zhojení je naopak vždy bezpečné: jakmile se prvek objeví (otevřený modal,
// dorovnaný obsah), příznak padá bez dalších podmínek.

export type AnchorComment = {
  id: number;
  isOrphaned: boolean;
  createdAt: Date;
};

export type AnchorStatusInput = {
  // Kořeny vláken na dané stránce, které uživatel SMÍ vidět (filtr viditelnosti
  // řeší volající přes visibleCommentsWhere).
  comments: AnchorComment[];
  // Kdy vznikla verze, ve které se komentáře zobrazují.
  versionCreatedAt: Date;
  // ID kotev, které prohlížeč na stránce NENAŠEL.
  missing: number[];
  // ID kotev, které prohlížeč našel (i skryté nebo překryté modalem — existují).
  present: number[];
};

export type AnchorStatusUpdates = {
  toOrphan: number[];
  toHeal: number[];
};

export function splitAnchorUpdates(input: AnchorStatusInput): AnchorStatusUpdates {
  const byId = new Map(input.comments.map((c) => [c.id, c]));
  const missing = new Set(input.missing);
  const present = new Set(input.present);

  const toOrphan: number[] = [];
  const toHeal: number[] = [];

  for (const id of missing) {
    // Prohlížeč poslal prvek v obou seznamech (souběh) → nedělej nic.
    if (present.has(id)) continue;
    const c = byId.get(id);
    if (!c || c.isOrphaned) continue;
    // Konzervativní zámek: jen přenesené komentáře (starší než jejich verze).
    if (c.createdAt.getTime() >= input.versionCreatedAt.getTime()) continue;
    toOrphan.push(id);
  }

  for (const id of present) {
    const c = byId.get(id);
    if (!c || !c.isOrphaned) continue;
    toHeal.push(id);
  }

  return { toOrphan, toHeal };
}
