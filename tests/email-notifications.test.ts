import { describe, it, expect, beforeAll } from "vitest";
import { isNotificationDeliverable } from "@/lib/notifications/eligibility";

// Sdílený re-check (zvoneček i e-mail). E-mail nese úryvek textu, takže je to
// kanál úniku interních komentářů - tyhle testy hlídají, že interní neproteče.
describe("isNotificationDeliverable", () => {
  const internalMember = { role: "COMMENTER" as const, isInternal: true };
  const externalMember = { role: "COMMENTER" as const, isInternal: false };
  const authorMember = { role: "AUTHOR" as const, isInternal: false };

  it("nečlen projektu nedostane nic", () => {
    expect(
      isNotificationDeliverable({
        member: undefined,
        commentVisibility: "PUBLIC",
        commentMissing: false,
      }),
    ).toBe(false);
  });

  it("chybějící komentář (zmizel) → nedoručitelné", () => {
    expect(
      isNotificationDeliverable({
        member: internalMember,
        commentVisibility: "PUBLIC",
        commentMissing: true,
      }),
    ).toBe(false);
  });

  it("INTERNÍ komentář externímu členovi NEPROJDE", () => {
    expect(
      isNotificationDeliverable({
        member: externalMember,
        commentVisibility: "INTERNAL",
        commentMissing: false,
      }),
    ).toBe(false);
  });

  it("INTERNÍ komentář internímu členovi projde", () => {
    expect(
      isNotificationDeliverable({
        member: internalMember,
        commentVisibility: "INTERNAL",
        commentMissing: false,
      }),
    ).toBe(true);
  });

  it("INTERNÍ komentář AUTOROVI projde (autor je vždy interní)", () => {
    expect(
      isNotificationDeliverable({
        member: authorMember,
        commentVisibility: "INTERNAL",
        commentMissing: false,
      }),
    ).toBe(true);
  });

  it("VEŘEJNÝ komentář externímu členovi projde", () => {
    expect(
      isNotificationDeliverable({
        member: externalMember,
        commentVisibility: "PUBLIC",
        commentMissing: false,
      }),
    ).toBe(true);
  });

  it("notifikace bez komentáře (požadavek/pozvánka) je doručitelná členovi", () => {
    expect(
      isNotificationDeliverable({
        member: externalMember,
        commentVisibility: null,
        commentMissing: false,
      }),
    ).toBe(true);
  });
});

// E-mail escapuje uživatelský text (jméno, úryvek) - obrana proti HTML injection.
describe("buildNotificationEmail escapuje obsah", () => {
  beforeAll(() => {
    process.env.APP_URL = "http://localhost:3000";
  });

  it("nebezpečné znaky ve jménu i úryvku jsou escapované", async () => {
    const { buildNotificationEmail } = await import(
      "@/lib/email/notification-email"
    );
    const { subject, html } = buildNotificationEmail([
      {
        kind: "NEW_REPLY",
        actorName: "<script>alert(1)</script>",
        projectName: "Projekt & spol",
        documentName: "Dokument",
        snippet: "text s <b>tagem</b> a \"uvozovkami\"",
        projectId: 1,
        documentId: 2,
        rootCommentId: 3,
      },
    ]);
    // Syrový <script> se do HTML nedostane.
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Projekt &amp; spol");
    // Odkaz na komentář je absolutní.
    expect(html).toContain(
      "http://localhost:3000/projects/1/documents/2?comment=3",
    );
    // Předmět nese jméno + typ události.
    expect(subject).toContain("odpověděl(a) ve vláknu");
  });
});
