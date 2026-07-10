import { describe, it, expect } from "vitest";
import {
  projectCreateSchema,
  invitationCreateSchema,
  memberPatchSchema,
} from "@/lib/validation";

describe("projectCreateSchema", () => {
  it("ořeže mezery a přijme platný vstup", () => {
    const r = projectCreateSchema.parse({ name: "  Diskuse  " });
    expect(r.name).toBe("Diskuse");
  });

  it("odmítne prázdný název a přelití délky", () => {
    expect(projectCreateSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      projectCreateSchema.safeParse({ name: "x".repeat(201) }).success,
    ).toBe(false);
  });
});

describe("invitationCreateSchema", () => {
  it("normalizuje e-mail na lowercase", () => {
    const r = invitationCreateSchema.parse({
      email: " Hana@Firma.CZ ",
      role: "COMMENTER",
    });
    expect(r.email).toBe("hana@firma.cz");
    expect(r.isInternal).toBe(false); // default
  });

  it("odmítne neplatný e-mail a neznámou roli", () => {
    expect(
      invitationCreateSchema.safeParse({ email: "neni-email", role: "READER" })
        .success,
    ).toBe(false);
    expect(
      invitationCreateSchema.safeParse({ email: "a@b.cz", role: "BOSS" })
        .success,
    ).toBe(false);
  });
});

describe("clientCreateSchema", () => {
  it("ořeže mezery a hlídá délku", async () => {
    const { clientCreateSchema } = await import("@/lib/validation");
    expect(clientCreateSchema.parse({ name: "  DDS  " }).name).toBe("DDS");
    expect(clientCreateSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      clientCreateSchema.safeParse({ name: "x".repeat(121) }).success,
    ).toBe(false);
  });
});

describe("memberPatchSchema", () => {
  it("vyžaduje aspoň jednu změnu", () => {
    expect(memberPatchSchema.safeParse({}).success).toBe(false);
    expect(memberPatchSchema.safeParse({ role: "READER" }).success).toBe(true);
    expect(memberPatchSchema.safeParse({ isInternal: true }).success).toBe(
      true,
    );
  });
});
