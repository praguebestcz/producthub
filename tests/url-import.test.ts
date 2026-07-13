import { describe, it, expect } from "vitest";
import { extractFetchUrls } from "@/lib/documents/url-import";

// Rozpoznání odkazů načítaných za běhu přes fetch() (např. spec.md u PB spec).
describe("extractFetchUrls", () => {
  const page = new URL("https://example.com/spec.html");
  const origin = "https://example.com";

  it("najde fetch('spec.md') a vrátí absolutní same-origin URL", () => {
    const html = `<script>fetch('spec.md').then(r=>r.text())</script>`;
    const urls = extractFetchUrls(html, page, origin).map((u) => u.toString());
    expect(urls).toContain("https://example.com/spec.md");
  });

  it("zvládne dvojité i zpětné uvozovky", () => {
    const src = `fetch("data/a.json"); fetch(\`b.txt\`)`;
    const urls = extractFetchUrls(src, page, origin).map((u) => u.pathname);
    expect(urls).toContain("/data/a.json");
    expect(urls).toContain("/b.txt");
  });

  it("ignoruje cizí doménu a šablonové řetězce", () => {
    const src = `fetch('https://cizi.cz/x.md'); fetch(\`\${base}/y.md\`)`;
    const urls = extractFetchUrls(src, page, origin);
    expect(urls).toHaveLength(0);
  });
});
