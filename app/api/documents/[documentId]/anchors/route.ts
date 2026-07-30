import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anchorStatusSchema } from "@/lib/validation";
import { visibleCommentsWhere } from "@/lib/comments/visibility";
import { splitAnchorUpdates } from "@/lib/comments/orphans";
import { latestVersionId } from "@/lib/documents/store";
import { signalCommentsChanged } from "@/lib/presence/hub";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// M9 v1.1 — Stupeň 2 osiřelosti. Prohlížeč po ustálení stránky hlásí, které
// kotvy komentářů na ní našel a které ne; server z toho konzervativně přepíná
// `isOrphaned` (pravidla v lib/comments/orphans.ts).
//
// Hlásí každý, kdo dokument smí vidět (READER+) — jde o technický příznak,
// ne o obsah. Proti zneužití: hlášení se přijímá jen pro NEJNOVĚJŠÍ verzi,
// dotčené komentáře se načítají přes filtr viditelnosti (neinterní člen tedy
// nepřepne příznak interního vlákna ani se nedozví, že existuje) a platí
// rate-limit.

const MAX_BODY_BYTES = 16_384;

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
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, projectId: true },
  });
  if (!document) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }
  const member = await requireProjectRole(user.id, document.projectId, "READER");
  if (!member) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }

  const rl = rateLimit(`anchors:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho požadavků, zkuste to za chvíli." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Příliš velké tělo požadavku" }, { status: 413 });
    }
    return NextResponse.json({ error: "Neplatný vstup" }, { status: 400 });
  }
  const parsed = anchorStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const { versionId, pagePath, missing, present } = parsed.data;

  // Starší verze jsou read-only (M9) — příznak osiřelosti se v nich nemění.
  const latest = await latestVersionId(documentId);
  if (latest === null || versionId !== latest) {
    return NextResponse.json({ changed: 0 });
  }
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, documentId },
    select: { createdAt: true },
  });
  if (!version) {
    return NextResponse.json({ changed: 0 });
  }

  const ids = [...new Set([...missing, ...present])];
  if (ids.length === 0) {
    return NextResponse.json({ changed: 0 });
  }

  // Jen kořeny vláken této stránky a verze, a jen ty, které uživatel smí vidět.
  const comments = await prisma.comment.findMany({
    where: {
      id: { in: ids },
      documentId,
      documentVersionId: versionId,
      pagePath,
      parentId: null,
      ...visibleCommentsWhere(member),
    },
    select: { id: true, isOrphaned: true, createdAt: true },
  });

  const { toOrphan, toHeal } = splitAnchorUpdates({
    comments,
    versionCreatedAt: version.createdAt,
    missing,
    present,
  });
  if (toOrphan.length === 0 && toHeal.length === 0) {
    return NextResponse.json({ changed: 0 });
  }

  const [orphaned, healed] = await prisma.$transaction([
    prisma.comment.updateMany({
      where: { id: { in: toOrphan } },
      data: { isOrphaned: true },
    }),
    prisma.comment.updateMany({
      where: { id: { in: toHeal } },
      data: { isOrphaned: false },
    }),
  ]);

  const changed = orphaned.count + healed.count;
  // Ať odznak dojede i ostatním, kdo mají dokument otevřený.
  if (changed > 0) signalCommentsChanged(documentId);
  return NextResponse.json({ changed });
}
