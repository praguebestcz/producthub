import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { canSeeInternal, getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentCreateSchema } from "@/lib/validation";
import {
  canViewComment,
  resolveReplyVisibility,
  visibleCommentsWhere,
} from "@/lib/comments/visibility";
import { invalidMentionIds } from "@/lib/comments/mentions";
import { createCommentNotifications } from "@/lib/comments/notifications";
import { signalCommentsChanged } from "@/lib/presence/hub";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// Komentáře dokumentu — čtení vláken (READER+) a vytvoření kořene/odpovědi
// (COMMENTER+). Viditelnost INTERNAL filtruje server přes lib/comments/visibility
// (závazné ze security review M6) — na kořenech I na odpovědích.

// Strop velikosti request body (security review M6) — kontrola PŘED čtením JSON.
const MAX_BODY_BYTES = 131_072;

// Explicitní select — NIKDY neposílat `screenshot` (bytea) ani interní FK navíc.
const authorSelect = { select: { id: true, name: true, avatarUrl: true } };
// Reakce emoji — kdo a čím reagoval. Zdědí filtr viditelnosti komentáře
// (nested select nad už filtrovaným komentářem), takže reakce interních
// komentářů se neinternímu členovi nevrátí.
const reactionSelect = {
  select: { emoji: true, userId: true, user: { select: { name: true } } },
} satisfies Prisma.Comment$reactionsArgs;

const replySelect = {
  id: true,
  parentId: true,
  body: true,
  visibility: true,
  createdAt: true,
  author: authorSelect,
  mentions: { select: { user: { select: { id: true, name: true } } } },
  reactions: reactionSelect,
} satisfies Prisma.CommentSelect;
const threadSelect = {
  id: true,
  documentVersionId: true,
  pagePath: true,
  body: true,
  visibility: true,
  status: true,
  dataReviewId: true,
  domPath: true,
  elementHtml: true,
  isOrphaned: true,
  viewportWidth: true,
  viewportHeight: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: { select: { id: true, name: true } },
  author: authorSelect,
  mentions: { select: { user: { select: { id: true, name: true } } } },
  reactions: reactionSelect,
} satisfies Prisma.CommentSelect;

// Dokument + členství s minimální rolí; nečlen i neexistující dokument = null (404).
async function loadDocumentForRole(
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
  if (!member) return null;
  return { document, member };
}

// GET /api/documents/[documentId]/comments?pagePath=...
// Vlákna dokumentu (bez pagePath všechny stránky). Kořeny chronologicky,
// odpovědi chronologicky; interní komentáře jen interním členům.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const ctx = await loadDocumentForRole(documentId, user.id, "READER");
  if (!ctx) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }

  const pagePath = req.nextUrl.searchParams.get("pagePath");
  const visibility = visibleCommentsWhere(ctx.member);

  const threads = await prisma.comment.findMany({
    where: {
      documentId,
      parentId: null,
      ...visibility,
      ...(pagePath ? { pagePath } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      ...threadSelect,
      replies: {
        // Filtr i na odpovědích — interní poznámka pod veřejným vláknem
        // nesmí uniknout neinternímu členovi.
        where: visibility,
        orderBy: { createdAt: "asc" },
        select: replySelect,
      },
    },
  });

  return NextResponse.json({ threads });
}

// POST /api/documents/[documentId]/comments — kořen vlákna NEBO odpověď.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const ctx = await loadDocumentForRole(documentId, user.id, "COMMENTER");
  if (!ctx) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }
  const { member } = ctx;

  // Rate-limit proti spamu komentářů (security review) — jako import/reakce.
  const rl = rateLimit(`comment:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho komentářů, chvíli počkejte." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Tělo se čte se stropem bajtů (ne přes content-length — chunked ji obejde).
  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "Komentář je příliš velký" },
        { status: 413 },
      );
    }
    throw e;
  }

  const parsed = commentCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Interní komentář smí založit jen interní člen.
  if (input.visibility === "INTERNAL" && !canSeeInternal(member)) {
    return NextResponse.json(
      { error: "Interní komentáře může psát jen interní člen" },
      { status: 400 },
    );
  }

  // Zmínky: jen členové projektu (security review M6 — jinak únik existence
  // projektu nečlenovi). Deaktivované účty se nezmiňují.
  if (input.mentions.length > 0) {
    const members = await prisma.projectMember.findMany({
      where: {
        projectId: ctx.document.projectId,
        userId: { in: input.mentions },
        user: { deactivatedAt: null },
      },
      select: { userId: true },
    });
    const invalid = invalidMentionIds(
      input.mentions,
      members.map((m) => m.userId),
    );
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Zmínit lze jen členy projektu" },
        { status: 400 },
      );
    }
  }

  // Data komentáře podle typu (kořen vs. odpověď).
  let data: Prisma.CommentUncheckedCreateInput;

  if (input.parentId !== undefined) {
    // Odpověď: rodič musí být KOŘEN téhož dokumentu a viditelný pro člena —
    // jinak 404 (existence interního vlákna se neprozrazuje).
    const parent = await prisma.comment.findFirst({
      where: { id: input.parentId, documentId, parentId: null },
      select: {
        id: true,
        visibility: true,
        pagePath: true,
        documentVersionId: true,
      },
    });
    if (!parent || !canViewComment(member, parent)) {
      return NextResponse.json(
        { error: "Vlákno nenalezeno" },
        { status: 404 },
      );
    }
    data = {
      projectId: ctx.document.projectId,
      documentId,
      // Odpověď dědí verzi i stránku z kořene (konzistence vlákna).
      documentVersionId: parent.documentVersionId,
      pagePath: parent.pagePath,
      authorId: user.id,
      parentId: parent.id,
      body: input.body,
      // INTERNAL rodič vynucuje INTERNAL odpověď.
      visibility: resolveReplyVisibility(parent.visibility, input.visibility),
    };
  } else {
    // Kořen: verze musí patřit k TOMUTO dokumentu (ne k cizímu).
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
    data = {
      projectId: ctx.document.projectId,
      documentId,
      documentVersionId: version.id,
      pagePath: input.pagePath!,
      authorId: user.id,
      body: input.body,
      visibility: input.visibility,
      dataReviewId: input.dataReviewId,
      domPath: input.domPath,
      elementHtml: input.elementHtml,
      viewportWidth: input.viewportWidth,
      viewportHeight: input.viewportHeight,
    };
  }

  // Atomicky: komentář + zmínky + notifikace (M7, zvoneček). Interní komentář
  // generuje notifikaci jen internímu příjemci (filtr v createCommentNotifications).
  const isReply = input.parentId !== undefined;
  const created = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({ data, select: { id: true } });
    if (input.mentions.length > 0) {
      await tx.mention.createMany({
        data: input.mentions.map((userId) => ({
          commentId: comment.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
    await createCommentNotifications(tx, {
      projectId: ctx.document.projectId,
      commentId: comment.id,
      // Kořen vlákna: u odpovědi je to rodič, u nového vlákna sám komentář.
      rootId: isReply ? input.parentId! : comment.id,
      actorId: user.id,
      baseType: isReply ? "NEW_REPLY" : "NEW_COMMENT",
      // data.visibility je u odpovědi už vyřešená (INTERNAL rodič vynucuje INTERNAL).
      isInternalComment: data.visibility === "INTERNAL",
      mentionedUserIds: input.mentions,
      scope: isReply ? "PARTICIPANTS" : "ALL_MEMBERS",
    });
    return comment;
  });

  // Živě oznámit ostatním u dokumentu, ať si komentáře přenačtou (M7 Fáze 2).
  signalCommentsChanged(documentId);

  return NextResponse.json({ id: created.id }, { status: 201 });
}
