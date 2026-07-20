import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret";
import { isOverLimit, estimateCostUsd } from "@/lib/ai/config";

describe("šifrování tajemství (AES-256-GCM)", () => {
  beforeAll(() => {
    process.env.SECRET_ENC_KEY = "test-enc-key-min-32-znaku-1234567890";
  });

  it("round-trip: zašifruje a dešifruje zpět", () => {
    const secret = "sk-ant-tajny-klic-9999";
    const enc = encryptSecret(secret);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain(secret); // ciphertext neobsahuje plain
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("každé šifrování má jiný výstup (náhodné IV)", () => {
    expect(encryptSecret("stejny-vstup")).not.toBe(encryptSecret("stejny-vstup"));
  });

  it("zmanipulovaný ciphertext neprojde (GCM integrita)", () => {
    const enc = encryptSecret("sk-ant-abc");
    const [, iv, tag] = enc.split(":");
    const tampered = ["v1", iv, tag, Buffer.from("podvrh").toString("base64")].join(
      ":",
    );
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("neznámý formát/verze vyhodí chybu", () => {
    expect(() => decryptSecret("v2:a:b:c")).toThrow();
    expect(() => decryptSecret("nesmysl")).toThrow();
  });
});

describe("isOverLimit", () => {
  it("0 = bez limitu (nikdy neblokuje)", () => {
    expect(isOverLimit(0, 0)).toBe(false);
    expect(isOverLimit(999, 0)).toBe(false);
  });
  it("blokuje při dosažení limitu", () => {
    expect(isOverLimit(4, 5)).toBe(false);
    expect(isOverLimit(5, 5)).toBe(true);
    expect(isOverLimit(6, 5)).toBe(true);
  });
});

describe("estimateCostUsd", () => {
  it("spočítá cenu z tokenů podle ceníku", () => {
    // 1M vstup + 1M výstup u sonnet-5 (3 + 15 USD/M).
    expect(estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000)).toBeCloseTo(
      18,
    );
    expect(estimateCostUsd("claude-sonnet-5", 0, 0)).toBe(0);
  });
});
