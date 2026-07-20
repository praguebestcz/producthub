import Anthropic from "@anthropic-ai/sdk";

// Převod připomínek recenzentů na KONKRÉTNÍ ZMĚNY (prompt pro Claude Code).
// Ne přepis komentářů — model má z diskuse vyvodit, co se má udělat.
// Vyžaduje ANTHROPIC_API_KEY (nastavuje Hana, ne Claude — bezpečnostní pravidlo).

// Model — vyvážený poměr kvalita/cena pro převod zpětné vazby na pokyny.
// Změna modelu = jen tady.
export const CHANGE_MODEL = "claude-sonnet-5";

// Chybí API klíč → route to přeloží na srozumitelnou hlášku (503), ne 500.
export class MissingApiKeyError extends Error {
  constructor() {
    super("Není nastavený Anthropic API klíč (ANTHROPIC_API_KEY).");
    this.name = "MissingApiKeyError";
  }
}

export function buildSystemPrompt(): string {
  return [
    "Jsi zkušený produktový analytik a vývojář v agentuře PragueBest.",
    "Dostaneš připomínky recenzentů ke konkrétním prvkům HTML specifikace, včetně diskuse pod nimi.",
    "",
    "Tvým úkolem je z připomínek a diskuse VYVODIT KONKRÉTNÍ ZMĚNY, které se mají ve specifikaci provést, a sepsat je jako jasné pokyny pro vývojáře (Claude Code).",
    "",
    "Pravidla:",
    "- NEOPISUJ připomínky. Rozhodni, co se má UDĚLAT, a napiš to imperativně (Uprav, Přidej, Odstraň, Sjednoť).",
    "- Vyhodnoť i diskusi — pokud padl závěr (například přidat přepínač), zapracuj ho jako výslednou změnu.",
    "- U každé změny uveď, kterého PRVKU a STRÁNKY se týká (kotva data-review-id nebo cesta, pokud je k dispozici).",
    "- Pokud z připomínky NEJDE jednoznačně určit změna, začni takový bod PŘESNĚ značkou: ⚠️ K upřesnění: a stručně popiš, co je potřeba doplnit (neodhaduj). Značku používej vždy stejně - aplikace podle ní body zvýrazní.",
    "- Nevymýšlej změny, které z připomínek nevyplývají. Drž se jen toho, co recenzenti řekli.",
    "- Piš česky, stručně a konkrétně, ve formátu Markdown: číslovaný seznam změn.",
    "- Respektuj omezení projektu, pokud jsou uvedená.",
    "",
    "Výstup vrať POUZE jako hotový markdown dokument (nadpis a číslovaný seznam změn), bez úvodních frází.",
  ].join("\n");
}

export function buildUserPrompt(input: {
  documentName: string;
  versionNumber: number;
  feedback: string;
  constraints?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(
    `Dokument: ${input.documentName} — verze ${input.versionNumber}`,
  );
  if (input.constraints && input.constraints.trim()) {
    parts.push("", `Omezení projektu (dodrž je):\n${input.constraints.trim()}`);
  }
  parts.push(
    "",
    "Připomínky recenzentů (podklad — z nich vyvoď změny):",
    "",
    input.feedback,
    "",
    `Sestav prompt se změnami. Začni nadpisem „# Úpravy specifikace: ${input.documentName} — verze ${input.versionNumber}".`,
  );
  return parts.join("\n");
}

// Zavolá Claudea a vrátí markdown se změnami. Vyhazuje MissingApiKeyError,
// když chybí klíč; jinak nechá bublat chybu SDK (route ji přeloží).
export async function synthesizeChanges(input: {
  documentName: string;
  versionNumber: number;
  feedback: string;
  constraints?: string | null;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: CHANGE_MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("AI vrátila prázdnou odpověď.");
  return text;
}
