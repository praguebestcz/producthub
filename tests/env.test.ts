import { describe, it, expect, afterEach } from "vitest";
import { getAdminEmails } from "@/lib/env";

const original = process.env.ADMIN_EMAILS;
afterEach(() => {
  process.env.ADMIN_EMAILS = original;
});

describe("getAdminEmails", () => {
  it("parsuje e-maily oddělené čárkou, lowercase, ořezané mezery", () => {
    process.env.ADMIN_EMAILS = " Hana@Gmail.com , druhy@firma.cz ";
    expect(getAdminEmails()).toEqual(["hana@gmail.com", "druhy@firma.cz"]);
  });

  it("prázdná proměnná = žádní admini", () => {
    process.env.ADMIN_EMAILS = "";
    expect(getAdminEmails()).toEqual([]);
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
  });
});
