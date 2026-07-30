import { describe, it, expect } from "vitest";
import { splitAnchorUpdates } from "@/lib/comments/orphans";

// M9 v1.1 — Stupeň 2 (osiřelost potvrzená za běhu v prohlížeči).
// Verze vznikla v poledne; komentář z rána = PŘENESENÝ z předchozí verze,
// komentář z odpoledne = napsaný až v téhle verzi.
const versionCreatedAt = new Date("2026-07-30T12:00:00Z");
const transferred = new Date("2026-07-29T08:00:00Z");
const bornHere = new Date("2026-07-30T14:00:00Z");

describe("splitAnchorUpdates — koho označit za osiřelého", () => {
  it("přenesený komentář s chybějícím prvkem osiří", () => {
    const r = splitAnchorUpdates({
      comments: [{ id: 1, isOrphaned: false, createdAt: transferred }],
      versionCreatedAt,
      missing: [1],
      present: [],
    });
    expect(r.toOrphan).toEqual([1]);
    expect(r.toHeal).toEqual([]);
  });

  it("komentář napsaný až v této verzi NEOSIŘÍ, i když prvek chybí", () => {
    // Konzervativní zámek: jeho prvek tam prokazatelně byl (např. tlačítko
    // uvnitř zavřeného modalu) — planý poplach se nesmí zapsat.
    const r = splitAnchorUpdates({
      comments: [{ id: 2, isOrphaned: false, createdAt: bornHere }],
      versionCreatedAt,
      missing: [2],
      present: [],
    });
    expect(r.toOrphan).toEqual([]);
  });

  it("komentář vzniklý přesně v čase verze se bere jako nový (neosiří)", () => {
    const r = splitAnchorUpdates({
      comments: [{ id: 3, isOrphaned: false, createdAt: versionCreatedAt }],
      versionCreatedAt,
      missing: [3],
      present: [],
    });
    expect(r.toOrphan).toEqual([]);
  });

  it("už osiřelý komentář se znovu nezapisuje", () => {
    const r = splitAnchorUpdates({
      comments: [{ id: 4, isOrphaned: true, createdAt: transferred }],
      versionCreatedAt,
      missing: [4],
      present: [],
    });
    expect(r.toOrphan).toEqual([]);
  });
});

describe("splitAnchorUpdates — zhojení", () => {
  it("nalezený prvek zhojí osiřelý komentář bez dalších podmínek", () => {
    const r = splitAnchorUpdates({
      comments: [
        { id: 5, isOrphaned: true, createdAt: transferred },
        { id: 6, isOrphaned: true, createdAt: bornHere },
      ],
      versionCreatedAt,
      missing: [],
      present: [5, 6],
    });
    expect(r.toHeal).toEqual([5, 6]);
    expect(r.toOrphan).toEqual([]);
  });

  it("nalezený prvek u neosiřelého komentáře nic nemění", () => {
    const r = splitAnchorUpdates({
      comments: [{ id: 7, isOrphaned: false, createdAt: transferred }],
      versionCreatedAt,
      missing: [],
      present: [7],
    });
    expect(r.toHeal).toEqual([]);
  });
});

describe("splitAnchorUpdates — okrajové případy", () => {
  it("prázdný vstup nic nemění", () => {
    const r = splitAnchorUpdates({
      comments: [],
      versionCreatedAt,
      missing: [],
      present: [],
    });
    expect(r).toEqual({ toOrphan: [], toHeal: [] });
  });

  it("neznámé ID (cizí nebo neviditelný komentář) se ignoruje", () => {
    // Filtr viditelnosti řeší volající — sem se dostanou jen povolené komentáře,
    // takže ID mimo seznam se nesmí nikam propsat.
    const r = splitAnchorUpdates({
      comments: [{ id: 8, isOrphaned: false, createdAt: transferred }],
      versionCreatedAt,
      missing: [999],
      present: [888],
    });
    expect(r).toEqual({ toOrphan: [], toHeal: [] });
  });

  it("ID v obou seznamech zároveň se neoznačí za osiřelé", () => {
    const r = splitAnchorUpdates({
      comments: [{ id: 9, isOrphaned: false, createdAt: transferred }],
      versionCreatedAt,
      missing: [9],
      present: [9],
    });
    expect(r.toOrphan).toEqual([]);
  });
});
