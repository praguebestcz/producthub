import { describe, it, expect } from "vitest";
import {
  computeRecipients,
  type RecipientMemberInfo,
} from "@/lib/comments/notifications";
import {
  formatRelativeCs,
  notificationMessage,
} from "@/lib/notifications/labels";

// Členové projektu (userId → role/isInternal/deaktivace).
const members = new Map<number, RecipientMemberInfo>([
  [1, { role: "AUTHOR", isInternal: false, deactivated: false }], // AUTHOR = interní vždy
  [2, { role: "COMMENTER", isInternal: true, deactivated: false }], // interní
  [3, { role: "COMMENTER", isInternal: false, deactivated: false }], // klient (neinterní)
  [4, { role: "READER", isInternal: false, deactivated: false }], // klient
  [5, { role: "COMMENTER", isInternal: false, deactivated: true }], // deaktivovaný
]);

// Pomocník: seřaď podle userId pro stabilní porovnání.
function sorted(list: { userId: number; type: string }[]) {
  return [...list].sort((a, b) => a.userId - b.userId);
}

describe("computeRecipients — vznik notifikací (M7)", () => {
  it("nový PUBLIC komentář: všem členům kromě aktéra a deaktivovaných", () => {
    const r = computeRecipients({
      candidateUserIds: [1, 2, 3, 4, 5],
      mentionedUserIds: [],
      baseType: "NEW_COMMENT",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
    });
    expect(sorted(r)).toEqual([
      { userId: 2, type: "NEW_COMMENT" },
      { userId: 3, type: "NEW_COMMENT" },
      { userId: 4, type: "NEW_COMMENT" },
      // 1 = aktér (vyloučen), 5 = deaktivovaný (vyloučen)
    ]);
  });

  it("INTERNAL komentář: jen interní příjemci (interní člen + AUTHOR), klient NE", () => {
    const r = computeRecipients({
      candidateUserIds: [1, 2, 3, 4],
      mentionedUserIds: [],
      baseType: "NEW_COMMENT",
      isInternalComment: true,
      actorId: 2, // aktér je interní člen
      memberIndex: members,
    });
    // Zůstane jen AUTHOR (1). 3 a 4 jsou klienti → nesmí dostat interní notifikaci.
    expect(sorted(r)).toEqual([{ userId: 1, type: "NEW_COMMENT" }]);
  });

  it("zmínka přebíjí základní typ (dedup na jednu notifikaci)", () => {
    const r = computeRecipients({
      candidateUserIds: [2, 3],
      mentionedUserIds: [3],
      baseType: "NEW_REPLY",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
    });
    expect(sorted(r)).toEqual([
      { userId: 2, type: "NEW_REPLY" },
      { userId: 3, type: "MENTION" }, // ne dvě notifikace, jen MENTION
    ]);
  });

  it("zmíněný, který není účastník, dostane MENTION", () => {
    const r = computeRecipients({
      candidateUserIds: [2], // účastník vlákna
      mentionedUserIds: [4], // zmíněný, ale ne účastník
      baseType: "NEW_REPLY",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
    });
    expect(sorted(r)).toEqual([
      { userId: 2, type: "NEW_REPLY" },
      { userId: 4, type: "MENTION" },
    ]);
  });

  it("zmíněný klient v INTERNAL komentáři nedostane nic (nevidí ho)", () => {
    const r = computeRecipients({
      candidateUserIds: [1, 2],
      mentionedUserIds: [3], // klient zmíněný v interním komentáři
      baseType: "NEW_COMMENT",
      isInternalComment: true,
      actorId: 1,
      memberIndex: members,
    });
    // 3 (klient) vyloučen viditelností; zůstane jen interní člen 2.
    expect(sorted(r)).toEqual([{ userId: 2, type: "NEW_COMMENT" }]);
  });

  it("aktér nedostane notifikaci ani když je zmíněný sám", () => {
    const r = computeRecipients({
      candidateUserIds: [2, 3],
      mentionedUserIds: [3],
      baseType: "NEW_REPLY",
      isInternalComment: false,
      actorId: 3, // aktér je zároveň zmíněný
      memberIndex: members,
    });
    expect(sorted(r)).toEqual([{ userId: 2, type: "NEW_REPLY" }]);
  });

  it("neznámý userId (už není členem) se přeskočí", () => {
    const r = computeRecipients({
      candidateUserIds: [2, 999],
      mentionedUserIds: [],
      baseType: "NEW_COMMENT",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
    });
    expect(sorted(r)).toEqual([{ userId: 2, type: "NEW_COMMENT" }]);
  });
});

describe("computeRecipients — preference notifikací (ALL / INVOLVED)", () => {
  // 2 a 3 mají INVOLVED, 4 má ALL (default).
  const scope = new Map([
    [2, "INVOLVED" as const],
    [3, "INVOLVED" as const],
    [4, "ALL" as const],
  ]);

  it("INVOLVED nedostane nový kořenový komentář (jen členství)", () => {
    const r = computeRecipients({
      candidateUserIds: [2, 3, 4],
      mentionedUserIds: [],
      baseType: "NEW_COMMENT",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
      scopeIndex: scope,
    });
    // 2 a 3 (INVOLVED) vypadnou, 4 (ALL) zůstane.
    expect(sorted(r)).toEqual([{ userId: 4, type: "NEW_COMMENT" }]);
  });

  it("INVOLVED dostane nový komentář, pokud je v něm ZMÍNĚN", () => {
    const r = computeRecipients({
      candidateUserIds: [2, 3, 4],
      mentionedUserIds: [2],
      baseType: "NEW_COMMENT",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
      scopeIndex: scope,
    });
    expect(sorted(r)).toEqual([
      { userId: 2, type: "MENTION" }, // zmíněn → chodí i při INVOLVED
      { userId: 4, type: "NEW_COMMENT" },
    ]);
  });

  it("INVOLVED dostane odpověď/změnu stavu (je účastník vlákna)", () => {
    const r = computeRecipients({
      candidateUserIds: [2, 3],
      mentionedUserIds: [],
      baseType: "NEW_REPLY",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
      scopeIndex: scope,
    });
    expect(sorted(r)).toEqual([
      { userId: 2, type: "NEW_REPLY" },
      { userId: 3, type: "NEW_REPLY" },
    ]);
  });

  it("bez scopeIndex se všichni chovají jako ALL (zpětná kompatibilita)", () => {
    const r = computeRecipients({
      candidateUserIds: [2, 3, 4],
      mentionedUserIds: [],
      baseType: "NEW_COMMENT",
      isInternalComment: false,
      actorId: 1,
      memberIndex: members,
    });
    expect(sorted(r).map((x) => x.userId)).toEqual([2, 3, 4]);
  });
});

describe("notificationMessage — text věty za jménem aktéra", () => {
  it("má text pro každý typ M7", () => {
    expect(notificationMessage("NEW_COMMENT")).toContain("komentář");
    expect(notificationMessage("NEW_REPLY")).toContain("odpověděl");
    expect(notificationMessage("MENTION")).toContain("zmínil");
    expect(notificationMessage("COMMENT_STATUS_CHANGED")).toContain("stav");
  });
});

describe("formatRelativeCs — relativní čas v češtině", () => {
  const now = new Date("2026-07-20T12:00:00Z").getTime();
  it("čerstvé = právě teď", () => {
    expect(formatRelativeCs("2026-07-20T11:59:30Z", now)).toBe("právě teď");
  });
  it("minuty a hodiny", () => {
    expect(formatRelativeCs("2026-07-20T11:55:00Z", now)).toBe("před 5 min");
    expect(formatRelativeCs("2026-07-20T09:00:00Z", now)).toBe("před 3 h");
  });
  it("dny s českým skloňováním", () => {
    expect(formatRelativeCs("2026-07-19T12:00:00Z", now)).toBe("před 1 dnem");
    expect(formatRelativeCs("2026-07-17T12:00:00Z", now)).toBe("před 3 dny");
  });
  it("neplatný vstup = prázdný řetězec", () => {
    expect(formatRelativeCs("nedatum", now)).toBe("");
  });
});
