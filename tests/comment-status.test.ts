import { describe, it, expect } from "vitest";
import { matchesStatusFilter } from "@/lib/comments/status";

describe("matchesStatusFilter", () => {
  it("open = nevyřešené (OPEN i REOPENED), ne vyřešené", () => {
    expect(matchesStatusFilter("OPEN", "open")).toBe(true);
    expect(matchesStatusFilter("REOPENED", "open")).toBe(true);
    expect(matchesStatusFilter("RESOLVED", "open")).toBe(false);
  });

  it("resolved = jen vyřešené", () => {
    expect(matchesStatusFilter("RESOLVED", "resolved")).toBe(true);
    expect(matchesStatusFilter("OPEN", "resolved")).toBe(false);
    expect(matchesStatusFilter("REOPENED", "resolved")).toBe(false);
  });

  it("all = vše", () => {
    expect(matchesStatusFilter("OPEN", "all")).toBe(true);
    expect(matchesStatusFilter("RESOLVED", "all")).toBe(true);
    expect(matchesStatusFilter("REOPENED", "all")).toBe(true);
  });
});
