// Sestavení markdown promptu z vybraných komentářových vláken (M8). Čistá
// funkce bez DOM/DB závislostí — testovatelná. Popis prvku (label) a popisek
// stránky počítá volající (v prohlížeči), sem chodí už hotové.

export type PromptReply = { authorName: string; body: string };

export type PromptItem = {
  label: string | null; // čitelný popis prvku, např. tlačítko „Odeslat"
  dataReviewId: string | null;
  domPath: string | null;
  pageLabel: string; // „Rozcestník" nebo relativní cesta stránky
  authorName: string;
  body: string;
  replies: PromptReply[];
};

// Značka, kterou AI označuje body, které nejdou z připomínky jednoznačně
// určit a potřebují doplnit od autora. Musí sedět s pokynem v lib/ai/change-prompt.ts.
export const CLARIFY_MARKER = "K upřesnění:";

// Najde v promptu body „k upřesnění" (vrátí text za značkou). Slouží k
// zvýraznění v okně — dokud tam značka je, autor má co doplnit.
export function findClarifications(text: string): string[] {
  const marker = CLARIFY_MARKER.toLowerCase();
  return text
    .split("\n")
    .map((line) => {
      const idx = line.toLowerCase().indexOf(marker);
      if (idx === -1) return null;
      return line.slice(idx + CLARIFY_MARKER.length).trim();
    })
    .filter((s): s is string => s !== null && s.length > 0);
}

// Popis prvku z HTML výstřižku BEZ DOM (regex) — použitelné i na serveru
// (deriveLabel v comment-panel.tsx potřebuje document.createElement). Stejná
// myšlenka: název typu prvku + začátek textu.
const TAG_LABELS: Record<string, string> = {
  a: "odkaz",
  button: "tlačítko",
  input: "pole",
  textarea: "pole",
  select: "výběr",
  img: "obrázek",
  h1: "nadpis",
  h2: "nadpis",
  h3: "nadpis",
  h4: "nadpis",
  p: "odstavec",
  li: "položka",
  td: "buňka",
  th: "buňka",
  label: "popisek",
  span: "text",
  div: "blok",
  section: "sekce",
  nav: "navigace",
  ul: "seznam",
  ol: "seznam",
  form: "formulář",
};

export function labelFromHtml(html: string | null): string | null {
  if (!html) return null;
  const tagMatch = html.match(/^\s*<([a-zA-Z0-9]+)/);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : null;
  const name = tag ? (TAG_LABELS[tag] ?? tag) : null;
  let text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > 40) text = text.slice(0, 40) + "…";
  if (!name) return text || null;
  return text ? `${name} „${text}"` : name;
}

// České skloňování „připomínka" podle počtu.
function pluralPripominka(n: number): string {
  if (n === 1) return "připomínka";
  if (n >= 2 && n <= 4) return "připomínky";
  return "připomínek";
}

export function buildPromptMarkdown(
  documentName: string,
  versionNumber: number,
  dateStr: string,
  items: PromptItem[],
): string {
  const lines: string[] = [];
  lines.push(`# Připomínky ke specifikaci: ${documentName}`);
  lines.push(
    `Verze ${versionNumber} · vygenerováno ${dateStr} · ${items.length} ${pluralPripominka(items.length)}`,
  );

  items.forEach((it, i) => {
    lines.push("");
    lines.push(`## ${i + 1}. ${it.label ?? "Připomínka"}`);

    // Kotva prvku: přednostně data-review-id, jinak DOM cesta.
    const anchor: string[] = [];
    if (it.dataReviewId) anchor.push(`data-review-id: ${it.dataReviewId}`);
    else if (it.domPath) anchor.push(`cesta: ${it.domPath}`);
    // Řádek „Prvek" jen když je co ukázat (komentář bez prvku ho vynechá).
    const prvek = [it.label, anchor.length ? `(${anchor.join(" | ")})` : null]
      .filter(Boolean)
      .join(" ");
    if (prvek) lines.push(`- Prvek: ${prvek}`);

    lines.push(`- Stránka: ${it.pageLabel}`);
    lines.push(`- Připomínka (${it.authorName}): ${it.body}`);

    if (it.replies.length > 0) {
      lines.push("- Diskuse:");
      for (const r of it.replies) {
        lines.push(`  - ${r.authorName}: ${r.body}`);
      }
    }
  });

  return lines.join("\n");
}
