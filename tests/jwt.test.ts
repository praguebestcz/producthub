import { describe, it, expect, beforeAll } from "vitest";
import {
  signSessionToken,
  verifySessionToken,
  signViewToken,
  verifyViewToken,
} from "@/lib/jwt";

// Bezpečnostní test (po expert review): session token a view token sdílejí
// JWT_SECRET, ale MUSÍ být vzájemně nepoužitelné — view token je v URL a jeho
// únik nesmí znamenat únik session.
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-min-32-znaku-dlouhy-retezec!";
});

describe("jwt — oddělení typů tokenů", () => {
  it("session token projde jen ověřením session", async () => {
    const token = await signSessionToken(42);
    const session = await verifySessionToken(token);
    expect(session?.userId).toBe(42);
    expect(session?.typ).toBe("session");
    // Stejný token NESMÍ projít jako view token.
    expect(await verifyViewToken(token)).toBeNull();
  });

  it("view token projde jen ověřením view", async () => {
    const token = await signViewToken(42, 7);
    const view = await verifyViewToken(token);
    expect(view?.userId).toBe(42);
    expect(view?.versionId).toBe(7);
    expect(view?.typ).toBe("view");
    // Stejný token NESMÍ projít jako session.
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("poškozený token neprojde vůbec", async () => {
    const token = await signSessionToken(1);
    const tampered = token.slice(0, -3) + "abc";
    expect(await verifySessionToken(tampered)).toBeNull();
    expect(await verifyViewToken(tampered)).toBeNull();
  });
});
