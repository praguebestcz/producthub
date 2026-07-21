import { describe, it, expect } from "vitest";
import {
  computeRoster,
  type PresentUser,
  type TypingInfo,
} from "@/lib/presence/roster";

// Přítomní u dokumentu: 1 = interní autor, 2 = interní člen, 3 = klient (externí),
// 4 = klient (externí), 2 má dvě spojení (dvě záložky).
const present: PresentUser[] = [
  { userId: 1, name: "Autor", avatarUrl: null, internal: true },
  { userId: 2, name: "Interní", avatarUrl: null, internal: true },
  { userId: 2, name: "Interní", avatarUrl: null, internal: true },
  { userId: 3, name: "Klient A", avatarUrl: null, internal: false },
  { userId: 4, name: "Klient B", avatarUrl: null, internal: false },
];

const NO_TYPING = new Map<number, TypingInfo>();

function ids(list: { userId: number }[]) {
  return list.map((x) => x.userId).sort((a, b) => a - b);
}

describe("computeRoster — kdo koho vidí (M7 Fáze 2)", () => {
  it("EXTERNÍ příjemce nevidí interní přítomné (jen ostatní externí)", () => {
    const roster = computeRoster(present, NO_TYPING, {
      userId: 3,
      canSeeInternal: false,
    });
    expect(ids(roster)).toEqual([4]);
  });

  it("INTERNÍ příjemce vidí všechny ostatní (interní i externí)", () => {
    const roster = computeRoster(present, NO_TYPING, {
      userId: 1,
      canSeeInternal: true,
    });
    expect(ids(roster)).toEqual([2, 3, 4]);
  });

  it("deduplikace: uživatel s víc spojeními je v seznamu jednou", () => {
    const roster = computeRoster(present, NO_TYPING, {
      userId: 4,
      canSeeInternal: false,
    });
    expect(ids(roster)).toEqual([3]);
    expect(roster.filter((r) => r.userId === 3)).toHaveLength(1);
  });

  it("umístění psaní projde stejným filtrem viditelnosti", () => {
    // interní 2 píše odpověď ve vláknu 5 na stránce index.html.
    const typing = new Map<number, TypingInfo>([
      [
        2,
        { pagePath: "index.html", threadId: 5, dataReviewId: null, domPath: null },
      ],
    ]);
    // externí příjemce interního píšícího vůbec nevidí.
    const ext = computeRoster(present, typing, {
      userId: 3,
      canSeeInternal: false,
    });
    expect(ext.some((r) => r.internal)).toBe(false);
    // interní příjemce vidí, KDE 2 píše; ostatní nepíší (typing null).
    const int = computeRoster(present, typing, {
      userId: 1,
      canSeeInternal: true,
    });
    expect(int.find((r) => r.userId === 2)?.typing?.threadId).toBe(5);
    expect(int.find((r) => r.userId === 3)?.typing).toBeNull();
  });

  it("prázdná přítomnost = prázdný seznam", () => {
    expect(
      computeRoster([], NO_TYPING, { userId: 1, canSeeInternal: true }),
    ).toEqual([]);
  });
});
