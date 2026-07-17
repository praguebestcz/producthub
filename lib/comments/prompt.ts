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
