import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentStatusSchema } from "@/lib/validation";
import { canViewComment } from "@/lib/comments/visibility";
import { createCommentNotifications } from "@/lib/comments/notifications";
import { signalCommentsChanged } from "@/lib/presence/hub";

// Změna stavu vlákna (Vyřešit / Znovu otevřít) — COMMENTER+ (design doc
// neomezuje na autora). Stav má jen kořenový komentář.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const commentId = Number((await params).commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      projectId: true,
      documentId: true,
      parentId: true,
      visibility: true,
      status: true,
    },
  });
  if (!comment) {
    return NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 });
  }

  const member = await requireProjectRole(user.id, comment.projectId, "COMMENTER");
  // Nečlen i neinterní člen nad INTERNAL vláknem dostane 404 — existence
  // se neprozrazuje (závazné ze security review M6).
  if (!member || !canViewComment(member, comment)) {
    return NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 });
  }

  if (comment.parentId !== null) {
    return NextResponse.json(
      { error: "Stav má jen celé vlákno, ne odpověď" },
      { status: 400 },
    );
  }

  const parsed = commentStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const { status } = parsed.data;

  // No-op přechody: RESOLVED→RESOLVED a OPEN/REOPENED→REOPENED nedávají smysl.
  if (status === "RESOLVED" && comment.status === "RESOLVED") {
    return NextResponse.json({ error: "Vlákno už je vyřešené" }, { status: 400 });
  }
  if (status === "REOPENED" && comment.status !== "RESOLVED") {
    return NextResponse.json(
      { error: "Znovu otevřít lze jen vyřešené vlákno" },
      { status: 400 },
    );
  }

  // Atomicky: změna stavu + notifikace účastníkům vlákna (M7, zvoneček).
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.comment.update({
      where: { id: commentId },
      data:
        status === "RESOLVED"
          ? { status, resolvedById: user.id, resolvedAt: new Date() }
          : { status, resolvedById: null, resolvedAt: null },
      select: { id: true, status: true, resolvedAt: true },
    });
    await createCommentNotifications(tx, {
      projectId: comment.projectId,
      commentId: comment.id, // kořen vlákna
      rootId: comment.id,
      actorId: user.id,
      baseType: "COMMENT_STATUS_CHANGED",
      isInternalComment: comment.visibility === "INTERNAL",
      mentionedUserIds: [],
      scope: "PARTICIPANTS",
    });
    return u;
  });

  // Živě oznámit ostatním u dokumentu (M7 Fáze 2).
  signalCommentsChanged(comment.documentId);

  return NextResponse.json(updated);
}
