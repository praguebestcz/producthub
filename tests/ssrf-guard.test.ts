import { describe, it, expect } from "vitest";
import { isPublicIp, validateUrl, SsrfError } from "@/lib/ssrf-guard";

// Bezpečnostní test (security review): SSRF ochrana importu z URL.
describe("isPublicIp", () => {
  it("odmítne privátní a interní IPv4", () => {
    for (const ip of [
      "10.0.0.1",
      "172.16.5.5",
      "192.168.1.1",
      "127.0.0.1",
      "0.0.0.0",
      "169.254.169.254", // cloud metadata!
      "100.64.0.1", // CGNAT
    ]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });

  it("povolí veřejné IPv4", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("93.184.216.34")).toBe(true);
  });

  it("odmítne loopback a IPv4-mapped IPv6 obcházení (vč. hex tvaru)", () => {
    expect(isPublicIp("::1")).toBe(false);
    expect(isPublicIp("::")).toBe(false);
    expect(isPublicIp("::ffff:169.254.169.254")).toBe(false);
    // Stejná metadata adresa v hex tvaru — dřív obešla ochranu (expert review).
    expect(isPublicIp("::ffff:a9fe:a9fe")).toBe(false);
    expect(isPublicIp("::ffff:7f00:1")).toBe(false); // 127.0.0.1
    expect(isPublicIp("::7f00:1")).toBe(false); // IPv4-compatible loopback
    expect(isPublicIp("fe80::1")).toBe(false);
    expect(isPublicIp("fc00::1")).toBe(false);
    expect(isPublicIp("fd12:3456::1")).toBe(false); // ULA
    expect(isPublicIp("ff02::1")).toBe(false); // multicast
  });

  it("povolí veřejnou IPv6 a mapovanou veřejnou IPv4", () => {
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true); // Cloudflare
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
  });
});

describe("validateUrl", () => {
  it("odmítne jiný protokol než http(s)", async () => {
    await expect(validateUrl("ftp://example.com")).rejects.toBeInstanceOf(
      SsrfError,
    );
    await expect(validateUrl("file:///etc/passwd")).rejects.toBeInstanceOf(
      SsrfError,
    );
  });

  it("odmítne nestandardní port", async () => {
    await expect(validateUrl("http://example.com:22/")).rejects.toBeInstanceOf(
      SsrfError,
    );
  });

  it("odmítne přímou privátní IP v hostname", async () => {
    await expect(validateUrl("http://127.0.0.1/")).rejects.toBeInstanceOf(
      SsrfError,
    );
    await expect(
      validateUrl("http://169.254.169.254/"),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("přijme běžnou veřejnou URL", async () => {
    const u = await validateUrl("https://example.com/page.html");
    expect(u.hostname).toBe("example.com");
  });
});
