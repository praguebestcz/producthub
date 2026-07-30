import { describe, it, expect } from "vitest";
import {
  commentCreateSchema,
  commentStatusSchema,
  reactionCreateSchema,
  anchorStatusSchema,
  commentAnchorSchema,
} from "@/lib/validation";

// Platný kořenový vstup — základ, který testy obměňují.
const validRoot = {
  body: "Tlačítko je moc malé.",
  documentVersionId: 1,
  pagePath: "index.html",
  domPath: "body > main > button:nth-of-type(1)",
  elementHtml: "<button>Odeslat</button>",
  viewportWidth: 1280,
  viewportHeight: 800,
};

describe("commentCreateSchema — kořen vlákna", () => {
  it("přijme platný kořen a doplní defaulty", () => {
    const r = commentCreateSchema.parse(validRoot);
    expect(r.visibility).toBe("PUBLIC");
    expect(r.mentions).toEqual([]);
    expect(r.body).toBe("Tlačítko je moc malé.");
  });

  it("odmítne kořen bez verze dokumentu nebo bez stránky", () => {
    expect(
      commentCreateSchema.safeParse({ body: "x", pagePath: "a.html" }).success,
    ).toBe(false);
    expect(
      commentCreateSchema.safeParse({ body: "x", documentVersionId: 1 }).success,
    ).toBe(false);
  });

  it("odmítne prázdné tělo i přelití limitu 10 000 znaků", () => {
    expect(
      commentCreateSchema.safeParse({ ...validRoot, body: "   " }).success,
    ).toBe(false);
    expect(
      commentCreateSchema.safeParse({ ...validRoot, body: "x".repeat(10_001) })
        .success,
    ).toBe(false);
  });

  it("hlídá limity kotvy (security review M6)", () => {
    expect(
      commentCreateSchema.safeParse({
        ...validRoot,
        elementHtml: "x".repeat(20_001),
      }).success,
    ).toBe(false);
    expect(
      commentCreateSchema.safeParse({ ...validRoot, domPath: "x".repeat(2_001) })
        .success,
    ).toBe(false);
    expect(
      commentCreateSchema.safeParse({
        ...validRoot,
        dataReviewId: "x".repeat(201),
      }).success,
    ).toBe(false);
    expect(
      commentCreateSchema.safeParse({ ...validRoot, pagePath: "x".repeat(501) })
        .success,
    ).toBe(false);
  });

  it("ZAHODÍ pole screenshot — API v1 ho nesmí přijmout", () => {
    const r = commentCreateSchema.parse({
      ...validRoot,
      screenshot: "AAAA",
    } as Record<string, unknown>);
    expect("screenshot" in r).toBe(false);
  });

  it("odmítne víc než 20 zmínek a nečíselné userId", () => {
    expect(
      commentCreateSchema.safeParse({
        ...validRoot,
        mentions: Array.from({ length: 21 }, (_, i) => i + 1),
      }).success,
    ).toBe(false);
    expect(
      commentCreateSchema.safeParse({ ...validRoot, mentions: [0] }).success,
    ).toBe(false);
  });

  it("odmítne nesmyslný viewport (0, přelití 20 000)", () => {
    expect(
      commentCreateSchema.safeParse({ ...validRoot, viewportWidth: 0 }).success,
    ).toBe(false);
    expect(
      commentCreateSchema.safeParse({ ...validRoot, viewportHeight: 20_001 })
        .success,
    ).toBe(false);
  });
});

describe("commentCreateSchema — odpověď", () => {
  it("přijme odpověď (jen parentId + text)", () => {
    const r = commentCreateSchema.parse({ body: "Souhlasím.", parentId: 5 });
    expect(r.parentId).toBe(5);
    expect(r.visibility).toBe("PUBLIC");
  });

  it("odmítne odpověď s vlastní kotvou / stránkou / verzí", () => {
    for (const extra of [
      { documentVersionId: 1 },
      { pagePath: "a.html" },
      { dataReviewId: "x" },
      { domPath: "body" },
      { elementHtml: "<b>x</b>" },
      { viewportWidth: 100 },
    ]) {
      expect(
        commentCreateSchema.safeParse({ body: "x", parentId: 5, ...extra })
          .success,
      ).toBe(false);
    }
  });
});

describe("commentStatusSchema", () => {
  it("přijme jen RESOLVED a REOPENED", () => {
    expect(commentStatusSchema.parse({ status: "RESOLVED" }).status).toBe(
      "RESOLVED",
    );
    expect(commentStatusSchema.parse({ status: "REOPENED" }).status).toBe(
      "REOPENED",
    );
    expect(commentStatusSchema.safeParse({ status: "OPEN" }).success).toBe(
      false,
    );
  });
});

describe("reactionCreateSchema", () => {
  it("přijme emoji z povolené sady", () => {
    expect(reactionCreateSchema.parse({ emoji: "👍" }).emoji).toBe("👍");
    expect(reactionCreateSchema.parse({ emoji: "✅" }).emoji).toBe("✅");
  });

  it("odmítne emoji mimo sadu i libovolný string (obrana proti XSS/spamu)", () => {
    expect(reactionCreateSchema.safeParse({ emoji: "😈" }).success).toBe(false);
    expect(reactionCreateSchema.safeParse({ emoji: "x".repeat(500) }).success).toBe(
      false,
    );
    expect(reactionCreateSchema.safeParse({ emoji: "" }).success).toBe(false);
  });
});

describe("anchorStatusSchema (M9 v1.1 — hlášení kotev z prohlížeče)", () => {
  const valid = { versionId: 3, pagePath: "index.html", missing: [1], present: [2] };

  it("přijme platné hlášení i prázdné seznamy", () => {
    expect(anchorStatusSchema.parse(valid).versionId).toBe(3);
    expect(
      anchorStatusSchema.safeParse({ ...valid, missing: [], present: [] }).success,
    ).toBe(true);
  });

  it("odmítne přetečené seznamy a nesmyslná ID", () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => i + 1);
    expect(anchorStatusSchema.safeParse({ ...valid, missing: tooMany }).success).toBe(
      false,
    );
    expect(anchorStatusSchema.safeParse({ ...valid, present: [0] }).success).toBe(
      false,
    );
    expect(anchorStatusSchema.safeParse({ ...valid, pagePath: "" }).success).toBe(
      false,
    );
  });
});

describe("commentAnchorSchema (M9 v1.1 — znovu připnutí)", () => {
  it("přijme kotvu přes data-review-id i přes domPath", () => {
    expect(
      commentAnchorSchema.safeParse({
        pagePath: "wf.html",
        dataReviewId: "question-submit",
      }).success,
    ).toBe(true);
    expect(
      commentAnchorSchema.safeParse({
        pagePath: "wf.html",
        domPath: "body > div:nth-child(2)",
        elementHtml: "<button>Odeslat</button>",
      }).success,
    ).toBe(true);
  });

  it("odmítne vstup bez kotvy — komentář by zůstal bez špendlíku", () => {
    expect(commentAnchorSchema.safeParse({ pagePath: "wf.html" }).success).toBe(
      false,
    );
  });

  it("hlídá limity délek", () => {
    expect(
      commentAnchorSchema.safeParse({
        pagePath: "wf.html",
        dataReviewId: "x".repeat(201),
      }).success,
    ).toBe(false);
    expect(
      commentAnchorSchema.safeParse({
        pagePath: "wf.html",
        domPath: "d".repeat(2_001),
      }).success,
    ).toBe(false);
  });
});
