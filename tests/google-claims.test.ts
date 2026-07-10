import { describe, it, expect } from "vitest";
import { validateGoogleClaims } from "@/lib/google-oauth";

// Bezpečnostní test (po expert review): bez email_verified === true jde
// převzít cizí pozvánku přes neověřený e-mail — validace to MUSÍ odmítnout.
const validClaims = {
  sub: "google-sub-123",
  email: "Hana.Test@Gmail.com",
  email_verified: true,
  name: "Hana Testová",
  picture: "https://example.com/a.png",
};

describe("validateGoogleClaims", () => {
  it("platné claimy vrátí profil s lowercase e-mailem", () => {
    const profile = validateGoogleClaims(validClaims);
    expect(profile.googleId).toBe("google-sub-123");
    expect(profile.email).toBe("hana.test@gmail.com");
    expect(profile.name).toBe("Hana Testová");
    expect(profile.avatarUrl).toBe("https://example.com/a.png");
  });

  it("odmítne neověřený e-mail (email_verified !== true)", () => {
    expect(() =>
      validateGoogleClaims({ ...validClaims, email_verified: false }),
    ).toThrow(/email_verified/);
    expect(() =>
      validateGoogleClaims({ ...validClaims, email_verified: "true" }),
    ).toThrow(/email_verified/);
    expect(() =>
      validateGoogleClaims({ ...validClaims, email_verified: undefined }),
    ).toThrow(/email_verified/);
  });

  it("odmítne chybějící sub nebo e-mail", () => {
    expect(() => validateGoogleClaims({ ...validClaims, sub: "" })).toThrow();
    expect(() =>
      validateGoogleClaims({ ...validClaims, email: "neni-email" }),
    ).toThrow();
  });

  it("bez jména použije e-mail", () => {
    const profile = validateGoogleClaims({ ...validClaims, name: undefined });
    expect(profile.name).toBe("hana.test@gmail.com");
  });
});
