import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import {
  importZip,
  sanitizeZipPath,
  ImportError,
} from "@/lib/documents/zip-import";

function makeZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, "utf-8"));
  }
  return zip.toBuffer();
}

describe("importZip", () => {
  it("rozbalí balík a zvolí index.html jako vstup", () => {
    const buf = makeZip({
      "index.html": "<html><body>Rozcestník</body></html>",
      "wf.html": "<html><body>Wireframy</body></html>",
      "style.css": "body{color:red}",
    });
    const r = importZip(buf);
    expect(r.entryPath).toBe("index.html");
    expect(r.files.map((f) => f.path).sort()).toEqual([
      "index.html",
      "style.css",
      "wf.html",
    ]);
    const css = r.files.find((f) => f.path === "style.css");
    expect(css?.contentType).toContain("text/css");
  });

  it("bez index.html zvolí nejmělčí HTML", () => {
    const buf = makeZip({
      "sub/deep.html": "<html></html>",
      "start.html": "<html></html>",
    });
    expect(importZip(buf).entryPath).toBe("start.html");
  });

  it("odmítne balík bez HTML stránky", () => {
    const buf = makeZip({ "style.css": "body{}" });
    expect(() => importZip(buf)).toThrow(ImportError);
  });
});

describe("sanitizeZipPath — ochrana proti zip-slip", () => {
  it("odmítne úniky z kořene a absolutní cesty", () => {
    expect(sanitizeZipPath("../evil.html")).toBeNull();
    expect(sanitizeZipPath("a/../../etc/passwd")).toBeNull();
    expect(sanitizeZipPath("/absolute.html")).toBeNull();
    expect(sanitizeZipPath("dir/")).toBeNull(); // adresář
  });

  it("povolí normální relativní cesty a sjednotí oddělovače", () => {
    expect(sanitizeZipPath("index.html")).toBe("index.html");
    expect(sanitizeZipPath("./page.html")).toBe("page.html");
    expect(sanitizeZipPath("assets\\style.css")).toBe("assets/style.css");
    expect(sanitizeZipPath("sub/deep/img.png")).toBe("sub/deep/img.png");
  });
});
