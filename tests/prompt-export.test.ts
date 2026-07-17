import { describe, it, expect } from "vitest";
import { buildPromptMarkdown, type PromptItem } from "@/lib/comments/prompt";

const base: PromptItem = {
  label: "tlačítko Odeslat",
  dataReviewId: "form-submit",
  domPath: "form > button:nth-of-type(1)",
  pageLabel: "Rozcestník",
  authorName: "Klient B",
  body: "Tlačítko má vést na microsite.",
  replies: [],
};

describe("buildPromptMarkdown", () => {
  it("hlavička nese název, verzi a počet připomínek", () => {
    const md = buildPromptMarkdown("Diskuse (SFX)", 2, "17. 7. 2026", [base]);
    expect(md).toContain("# Připomínky ke specifikaci: Diskuse (SFX)");
    expect(md).toContain("Verze 2 · vygenerováno 17. 7. 2026 · 1 připomínka");
  });

  it("preferuje data-review-id před cestou a uvádí autora", () => {
    const md = buildPromptMarkdown("Doc", 1, "1. 1. 2026", [base]);
    expect(md).toContain("## 1. tlačítko Odeslat");
    expect(md).toContain("data-review-id: form-submit");
    expect(md).not.toContain("cesta: form > button");
    expect(md).toContain("- Připomínka (Klient B): Tlačítko má vést na microsite.");
  });

  it("bez data-review-id použije DOM cestu", () => {
    const md = buildPromptMarkdown("Doc", 1, "1. 1. 2026", [
      { ...base, dataReviewId: null },
    ]);
    expect(md).toContain("cesta: form > button:nth-of-type(1)");
  });

  it("komentář bez prvku vynechá řádek Prvek, stránku ponechá", () => {
    const md = buildPromptMarkdown("Doc", 1, "1. 1. 2026", [
      { ...base, label: null, dataReviewId: null, domPath: null },
    ]);
    expect(md).not.toContain("- Prvek:");
    expect(md).toContain("- Stránka: Rozcestník");
    expect(md).toContain("## 1. Připomínka");
  });

  it("vypíše celou diskusi (odpovědi s autory)", () => {
    const md = buildPromptMarkdown("Doc", 1, "1. 1. 2026", [
      {
        ...base,
        replies: [
          { authorName: "Hana", body: "Souhlasím." },
          { authorName: "Klient B", body: "Díky." },
        ],
      },
    ]);
    expect(md).toContain("- Diskuse:");
    expect(md).toContain("  - Hana: Souhlasím.");
    expect(md).toContain("  - Klient B: Díky.");
  });

  it("čísluje víc připomínek a skloňuje", () => {
    const md = buildPromptMarkdown("Doc", 1, "1. 1. 2026", [base, base, base]);
    expect(md).toContain("· 3 připomínky");
    expect(md).toContain("## 1.");
    expect(md).toContain("## 2.");
    expect(md).toContain("## 3.");
  });
});
