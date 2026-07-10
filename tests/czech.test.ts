import { describe, it, expect } from "vitest";
import { plural } from "@/lib/czech";

describe("plural — české skloňování počtů", () => {
  it("skloňuje dokumenty", () => {
    expect(plural(0, "dokument", "dokumenty", "dokumentů")).toBe("dokumentů");
    expect(plural(1, "dokument", "dokumenty", "dokumentů")).toBe("dokument");
    expect(plural(2, "dokument", "dokumenty", "dokumentů")).toBe("dokumenty");
    expect(plural(4, "dokument", "dokumenty", "dokumentů")).toBe("dokumenty");
    expect(plural(5, "dokument", "dokumenty", "dokumentů")).toBe("dokumentů");
    expect(plural(12, "dokument", "dokumenty", "dokumentů")).toBe("dokumentů");
  });
});
