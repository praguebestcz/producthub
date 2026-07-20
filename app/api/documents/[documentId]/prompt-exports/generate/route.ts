import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { canSeeInternal, getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promptGenerateSchema } from "@/lib/validation";
import { visibleCommentsWhere } from "@/lib/comments/visibility";
import {
  buildPromptMarkdown,
  labelFromHtml,
  type PromptItem,
} from "@/lib/comments/prompt";
import { MissingApiKeyError, synthesizeChanges } from "@/lib/ai/change-prompt";
import {
  KeyDecryptError,
  getAppConfig,
  isOverBudget,
  logAiUsage,
  monthlyUsageSummary,
  resolveAnthropicApiKey,
} from "@/lib/ai/config";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/documents/[documentId]/prompt-exports/generate
// Z vybraných komentářů vygeneruje přes AI (Claude) prompt se ZMĚNAMI.
// Přístup JEN internímu týmu (jako ostatní prompt-export routy). Server si
// komentáře načte z DB (autoritativně, s filtrem viditelnosti) — nedůvěřuje
// textu z klienta.

// {documentVersionId, commentIds, clarification, currentDraft} — currentDraft
// může být celý prompt (až ~1 MB), proto vyšší strop.
const MAX_BODY_BYTES = 1_300_000;

const authorSelect = { select: { name: true } };
const replySelect = {
  body: true,
  visibility: true,
  createdAt: true,
  author: authorSelect,
} satisfies Prisma.CommentSelect;
const threadSelect = {
  id: true,
  pagePath: true,
  body: true,
  dataReviewId: true,
  domPath: true,
  elementHtml: true,
  author: authorSelect,
} satisfies Prisma.CommentSelect;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, name: true, projectId: true },
  });
  if (!document) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  const member = await requireProjectRole(
    user.id,
    document.projectId,
    "COMMENTER",
  );
  if (!member || !canSeeInternal(member)) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  // AI volání stojí peníze — přísnější rate-limit.
  const rl = rateLimit(`prompt-gen:${user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho generování, chvíli počkejte." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Neplatný vstup" }, { status: 413 });
    }
    throw e;
  }

  const parsed = promptGenerateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const { documentVersionId, commentIds, clarification, currentDraft } =
    parsed.data;

  const version = await prisma.documentVersion.findFirst({
    where: { id: documentVersionId, documentId },
    select: { id: true, versionNumber: true, entryPath: true },
  });
  if (!version) {
    return NextResponse.json(
      { error: "Verze nepatří k dokumentu" },
      { status: 400 },
    );
  }

  // Načíst vybraná KOŘENOVÁ vlákna dané verze — jen ta, která člen SMÍ vidět
  // (filtr viditelnosti na kořeni i odpovědích). Cizí/nevyřešenost neřešíme
  // tady (klient posílá výběr), ale interní text uvidí jen interní člen (ten
  // jediný sem projde) a jen komentáře tohoto dokumentu/verze.
  const visibility = visibleCommentsWhere(member);
  const threads = await prisma.comment.findMany({
    where: {
      id: { in: commentIds },
      documentId,
      documentVersionId,
      parentId: null,
      ...visibility,
    },
    orderBy: { createdAt: "asc" },
    select: {
      ...threadSelect,
      replies: {
        where: visibility,
        orderBy: { createdAt: "asc" },
        select: replySelect,
      },
    },
  });
  if (threads.length === 0) {
    return NextResponse.json(
      { error: "Žádné použitelné komentáře k vytvoření promptu" },
      { status: 400 },
    );
  }

  // Sestav strukturovaný podklad (stejný formát jako dřív) — vstup pro AI.
  // GDPR (review 2026-07-20): jména autorů se do Anthropic (USA) NEPOSÍLAJÍ —
  // pro odvození změn nejsou nutná. Nahrazují se pseudonymem „Recenzent N"
  // (konzistentně v rámci jednoho generování, ať diskuse dává smysl).
  const aliasMap = new Map<string, string>();
  const alias = (name: string): string => {
    let a = aliasMap.get(name);
    if (!a) {
      a = `Recenzent ${aliasMap.size + 1}`;
      aliasMap.set(name, a);
    }
    return a;
  };
  const items: PromptItem[] = threads.map((t) => ({
    label: labelFromHtml(t.elementHtml),
    dataReviewId: t.dataReviewId,
    domPath: t.domPath,
    pageLabel: t.pagePath === version.entryPath ? "Rozcestník" : t.pagePath,
    authorName: alias(t.author.name),
    body: t.body,
    replies: t.replies.map((r) => ({
      authorName: alias(r.author.name),
      body: r.body,
    })),
  }));
  const feedback = buildPromptMarkdown(
    document.name,
    version.versionNumber,
    "(podklad)",
    items,
  );

  // Měsíční rozpočet na AI (app-wide, admin nastavení) — kontrola PŘED placeným
  // voláním. 0 = bez limitu. Porovnává už utracený odhad ceny za měsíc.
  const cfg = await getAppConfig();
  if (cfg.monthlyBudgetUsdCents > 0) {
    const spent = await monthlyUsageSummary();
    if (isOverBudget(spent.costUsd, cfg.monthlyBudgetUsdCents / 100)) {
      return NextResponse.json(
        {
          error: `Vyčerpán měsíční rozpočet na AI ($${(cfg.monthlyBudgetUsdCents / 100).toFixed(2)}). Zvyšte ho v AI nastavení.`,
        },
        { status: 429 },
      );
    }
  }

  // Klíč pro Claude: z DB (dešifrovaný) má přednost, jinak env.
  let apiKey: string | null;
  try {
    apiKey = await resolveAnthropicApiKey();
  } catch (e) {
    if (e instanceof KeyDecryptError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }

  // Omezení projektu (vkládá se do promptu) — pokud jsou nastavená.
  const project = await prisma.project.findUnique({
    where: { id: document.projectId },
    select: { constraints: true },
  });

  try {
    const { text: body, usage } = await synthesizeChanges({
      documentName: document.name,
      versionNumber: version.versionNumber,
      feedback,
      constraints: project?.constraints,
      clarification,
      currentDraft,
      apiKey,
    });
    // Log spotřeby (jen po úspěchu) — podklad pro limit i přehled ceny.
    await logAiUsage({
      projectId: document.projectId,
      userId: user.id,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    return NextResponse.json({ body });
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error:
            "AI generování zatím není nastavené (chybí Anthropic API klíč). Nastavte ho v AI nastavení nebo přes ANTHROPIC_API_KEY.",
        },
        { status: 503 },
      );
    }
    console.error("prompt generate failed", e);
    return NextResponse.json(
      { error: "Generování přes AI se nezdařilo, zkuste to znovu." },
      { status: 502 },
    );
  }
}
