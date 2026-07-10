import { describe, it, expect } from "vitest";
import { roleAtLeast, canSeeInternal } from "@/lib/auth";

// Přístupová logika rolí — základ všech projektových kontrol (security review).
describe("roleAtLeast", () => {
  it("AUTHOR splní všechny úrovně", () => {
    expect(roleAtLeast("AUTHOR", "AUTHOR")).toBe(true);
    expect(roleAtLeast("AUTHOR", "COMMENTER")).toBe(true);
    expect(roleAtLeast("AUTHOR", "READER")).toBe(true);
  });

  it("COMMENTER nesmí to, co jen AUTHOR", () => {
    expect(roleAtLeast("COMMENTER", "AUTHOR")).toBe(false);
    expect(roleAtLeast("COMMENTER", "COMMENTER")).toBe(true);
    expect(roleAtLeast("COMMENTER", "READER")).toBe(true);
  });

  it("READER smí jen číst", () => {
    expect(roleAtLeast("READER", "AUTHOR")).toBe(false);
    expect(roleAtLeast("READER", "COMMENTER")).toBe(false);
    expect(roleAtLeast("READER", "READER")).toBe(true);
  });
});

describe("canSeeInternal", () => {
  it("AUTHOR vidí interní vždy (i bez příznaku)", () => {
    expect(canSeeInternal({ role: "AUTHOR", isInternal: false })).toBe(true);
  });

  it("neinterní COMMENTER/READER interní NEvidí", () => {
    expect(canSeeInternal({ role: "COMMENTER", isInternal: false })).toBe(false);
    expect(canSeeInternal({ role: "READER", isInternal: false })).toBe(false);
  });

  it("interní příznak otevírá interní komentáře", () => {
    expect(canSeeInternal({ role: "COMMENTER", isInternal: true })).toBe(true);
    expect(canSeeInternal({ role: "READER", isInternal: true })).toBe(true);
  });
});
