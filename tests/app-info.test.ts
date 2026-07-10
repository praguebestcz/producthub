import { describe, it, expect } from "vitest";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/app-info";

// Sanity test milníku M0: ověří, že funguje vitest + alias "@/" na kořen projektu
// (stejný mechanismus budou používat všechny další testy).
describe("app-info", () => {
  it("má název aplikace", () => {
    expect(APP_NAME).toBe("ProductHub");
  });

  it("popis je česky a zmiňuje specifikace", () => {
    expect(APP_DESCRIPTION).toContain("specifikací");
  });
});
