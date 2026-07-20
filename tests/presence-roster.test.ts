import { describe, it, expect } from "vitest";
import { computeRoster, type PresentUser } from "@/lib/presence/roster";

// Přítomní u dokumentu: 1 = interní autor, 2 = interní člen, 3 = klient (externí),
// 4 = klient (externí), 2 má dvě spojení (dvě záložky).
const present: PresentUser[] = [
  { userId: 1, name: "Autor", avatarUrl: null, internal: true },
  { userId: 2, name: "Interní", avatarUrl: null, internal: true },
  { userId: 2, name: "Interní", avatarUrl: null, internal: true },
  { userId: 3, name: "Klient A", avatarUrl: null, internal: false },
  { userId: 4, name: "Klient B", avatarUrl: null, internal: false },
];

function ids(list: { userId: number }[]) {
  return list.map((x) => x.userId).sort((a, b) => a - b);
}

describe("computeRoster — kdo koho vidí (M7 Fáze 2)", () => {
  it("EXTERNÍ příjemce nevidí interní přítomné (jen ostatní externí)", () => {
    const roster = computeRoster(present, new Set(), {
      userId: 3,
      canSeeInternal: false,
    });
    // klient 3 vidí jen klienta 4; interní 1 a 2 skryti; sebe ne.
    expect(ids(roster)).toEqual([4]);
  });

  it("INTERNÍ příjemce vidí všechny ostatní (interní i externí)", () => {
    const roster = computeRoster(present, new Set(), {
      userId: 1,
      canSeeInternal: true,
    });
    // autor 1 vidí 2, 3, 4 (ne sebe), interní 2 jen jednou (dedup).
    expect(ids(roster)).toEqual([2, 3, 4]);
  });

  it("deduplikace: uživatel s víc spojeními je v seznamu jednou", () => {
    const roster = computeRoster(present, new Set(), {
      userId: 4,
      canSeeInternal: false,
    });
    // klient 4 vidí jen klienta 3 (interní skryti, sebe ne, 2 by byl skryt tak jako tak).
    expect(ids(roster)).toEqual([3]);
    expect(roster.filter((r) => r.userId === 3)).toHaveLength(1);
  });

  it("příznak píše projde stejným filtrem viditelnosti", () => {
    // interní 2 píše → externí příjemce ho vůbec nevidí (ani jako píšícího).
    const extRoster = computeRoster(present, new Set([2]), {
      userId: 3,
      canSeeInternal: false,
    });
    expect(extRoster.some((r) => r.internal)).toBe(false);
    // interní příjemce vidí, že 2 píše.
    const intRoster = computeRoster(present, new Set([2]), {
      userId: 1,
      canSeeInternal: true,
    });
    expect(intRoster.find((r) => r.userId === 2)?.typing).toBe(true);
    expect(intRoster.find((r) => r.userId === 3)?.typing).toBe(false);
  });

  it("prázdná přítomnost = prázdný seznam", () => {
    expect(computeRoster([], new Set(), { userId: 1, canSeeInternal: true })).toEqual(
      [],
    );
  });
});
