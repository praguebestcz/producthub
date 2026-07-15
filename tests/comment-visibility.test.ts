import { describe, it, expect } from "vitest";
import {
  visibleCommentsWhere,
  canViewComment,
  resolveReplyVisibility,
} from "@/lib/comments/visibility";
import { invalidMentionIds } from "@/lib/comments/mentions";

// Security testy M6 — vynucení viditelnosti interních komentářů.
// Členové pro kombinace role × isInternal:
const externalReader = { role: "READER", isInternal: false } as const;
const externalCommenter = { role: "COMMENTER", isInternal: false } as const;
const internalCommenter = { role: "COMMENTER", isInternal: true } as const;
const author = { role: "AUTHOR", isInternal: false } as const; // AUTHOR je interní vždy

describe("visibleCommentsWhere — Prisma where-fragment podle člena", () => {
  it("neinterní člen dostane filtr jen na PUBLIC", () => {
    expect(visibleCommentsWhere(externalReader)).toEqual({
      visibility: "PUBLIC",
    });
    expect(visibleCommentsWhere(externalCommenter)).toEqual({
      visibility: "PUBLIC",
    });
  });

  it("interní člen a AUTHOR vidí vše (prázdný fragment)", () => {
    expect(visibleCommentsWhere(internalCommenter)).toEqual({});
    expect(visibleCommentsWhere(author)).toEqual({});
  });
});

describe("canViewComment — predikát pro jeden komentář", () => {
  it("PUBLIC vidí každý člen", () => {
    expect(canViewComment(externalReader, { visibility: "PUBLIC" })).toBe(true);
    expect(canViewComment(author, { visibility: "PUBLIC" })).toBe(true);
  });

  it("INTERNAL vidí jen interní člen a AUTHOR", () => {
    expect(canViewComment(externalCommenter, { visibility: "INTERNAL" })).toBe(
      false,
    );
    expect(canViewComment(internalCommenter, { visibility: "INTERNAL" })).toBe(
      true,
    );
    expect(canViewComment(author, { visibility: "INTERNAL" })).toBe(true);
  });
});

describe("resolveReplyVisibility — INTERNAL rodič vynucuje INTERNAL", () => {
  it("veřejná odpověď pod interním vláknem se VYNUTÍ na INTERNAL", () => {
    expect(resolveReplyVisibility("INTERNAL", "PUBLIC")).toBe("INTERNAL");
    expect(resolveReplyVisibility("INTERNAL", "INTERNAL")).toBe("INTERNAL");
  });

  it("pod veřejným vláknem platí požadovaná viditelnost", () => {
    expect(resolveReplyVisibility("PUBLIC", "PUBLIC")).toBe("PUBLIC");
    // Interní poznámka pod veřejnou diskusí je dovolená.
    expect(resolveReplyVisibility("PUBLIC", "INTERNAL")).toBe("INTERNAL");
  });
});

describe("invalidMentionIds — zmínit lze jen členy projektu", () => {
  it("vrátí userId, která nejsou členy (deduplikovaně)", () => {
    expect(invalidMentionIds([1, 2, 3, 3], [1, 2])).toEqual([3]);
    expect(invalidMentionIds([7, 8], [1, 2])).toEqual([7, 8]);
  });

  it("prázdný výsledek = všechny zmínky platné", () => {
    expect(invalidMentionIds([1, 2], [1, 2, 3])).toEqual([]);
    expect(invalidMentionIds([], [1])).toEqual([]);
  });
});
