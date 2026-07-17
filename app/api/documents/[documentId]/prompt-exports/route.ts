import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { canSeeInternal, getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promptExportCreateSchema } from "@/lib/validation";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// „Zadání" (M8) — uložené prompty z komentářů pro Claude Code.
// PŘÍSTUP JEN INTERNÍMU TÝMU (závazné z db-security-expert review): body může
// nést text INTERNAL komentářů, klient-recenzent nesmí dostat UI ani data.
// - list: člen projektu (READER+) A canSeeInternal, jinak 404
// - create: člen (COMMENTER+) A canSeeInternal, jinak 404

// Bajtový strop na body (i DB CHECK) — obrana do hloubky pod aplikačním limitem.
const MAX_BODY_BYTES = 1_048_576;
// Strop celého request body (JSON obálka kolem promptu) — chunked obejde content-length.
const MAX_REQUEST_BYTES = 1_200_000;

const exportSelect = {
  id: true,
  title: true,
  body: true,
  status: true,
  commentIds: true,
  documentVersionId: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.PromptExportSelect;

// Dokument + členství; nečlen i neexistující dokument = null (→ 404).
// Navíc gate na interního člena (klient nesmí zadání ani vidět).
async function loadInternalCtx(
  documentId: number,
  userId: number,
  minRole: "READER" | "COMMENTER",
) {
  if (!Number.isInteger(documentId) || documentId <= 0) return null;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, projectId: true },
  });
  if (!document) return null;
  const member = await requireProjectRole(userId, document.projectId, minRole);
  if (!member || !canSeeInternal(member)) return null;
  return { document, member };
}

// GET /api/documents/[documentId]/prompt-exports — seznam zadání dokumentu.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const ctx = await loadInternalCtx(documentId, user.id, "READER");
  if (!ctx) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const exports = await prisma.promptExport.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    select: exportSelect,
  });
  return NextResponse.json({ exports });
}

// POST /api/documents/[documentId]/prompt-exports — uložit nové zadání.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const ctx = await loadInternalCtx(documentId, user.id, "COMMENTER");
  if (!ctx) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const rl = rateLimit(`prompt-export:${user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho zadání, chvíli počkejte." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_REQUEST_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "Zadání je příliš velké" },
        { status: 413 },
      );
    }
    throw e;
  }

  const parsed = promptExportCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Bajtový strop na body (pod DB CHECK, ať nevznikne 500 z porušení constraintu).
  if (Buffer.byteLength(input.body, "utf-8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Zadání je příliš velké" }, { status: 413 });
  }

  // Verze musí patřit k TOMUTO dokumentu (ne k cizímu) — vzor jako u komentářů.
  const version = await prisma.documentVersion.findFirst({
    where: { id: input.documentVersionId, documentId },
    select: { id: true },
  });
  if (!version) {
    return NextResponse.json(
      { error: "Verze nepatří k dokumentu" },
      { status: 400 },
    );
  }

  // Každé commentId musí patřit k tomuto dokumentu (jinak cross-project leak
  // do snapshotu) — závazné z db-security-expert review.
  const uniqueCommentIds = [...new Set(input.commentIds)];
  if (uniqueCommentIds.length > 0) {
    const belongCount = await prisma.comment.count({
      where: { id: { in: uniqueCommentIds }, documentId },
    });
    if (belongCount !== uniqueCommentIds.length) {
      return NextResponse.json(
        { error: "Komentář nepatří k dokumentu" },
        { status: 400 },
      );
    }
  }

  const created = await prisma.promptExport.create({
    data: {
      documentId,
      documentVersionId: version.id,
      createdById: user.id,
      title: input.title,
      body: input.body,
      commentIds: uniqueCommentIds,
    },
    select: exportSelect,
  });

  return NextResponse.json({ export: created }, { status: 201 });
}
