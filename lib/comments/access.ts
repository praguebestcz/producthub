import type { ProjectMember } from "@prisma/client";
import { requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewComment } from "@/lib/comments/visibility";
import { latestVersionId } from "@/lib/documents/store";

// Sdílené kontroly pro akce nad JEDNÍM existujícím komentářem (úprava, smazání,
// znovu připnutí). Drží pohromadě tři pravidla, na kterých se rozhoduje:
//   1. viditelnost — nečlen i neinterní člen nad INTERNAL vláknem dostanou 404
//      (existence se neprozrazuje, stejný princip jako requireProjectRole),
//   2. vlastnictví — dle režimu (viz `allow`),
//   3. read-only starší verze (M9) — psát lze jen v NEJNOVĚJŠÍ verzi.
// Vrací prostý výsledek (ne NextResponse), routa si z něj složí odpověď.

export type CommentForAction = {
  id: number;
  projectId: number;
  documentId: number;
  documentVersionId: number;
  parentId: number | null;
  authorId: number;
  visibility: "PUBLIC" | "INTERNAL";
  pagePath: string;
};

export type CommentAccess =
  | { ok: true; comment: CommentForAction; member: ProjectMember }
  | { ok: false; status: 403 | 404 | 409; error: string };

// `own` = jen autor komentáře (úprava, smazání).
// `ownOrProjectAuthor` = autor komentáře NEBO autor projektu (znovu připnutí —
// kotvy po nahrání nové verze rovná ten, kdo verzi nahrál, ne klient).
export async function loadCommentForAction(
  commentId: number,
  userId: number,
  allow: "own" | "ownOrProjectAuthor",
): Promise<CommentAccess> {
  const notFound = { ok: false, status: 404, error: "Komentář nenalezen" } as const;
  if (!Number.isInteger(commentId) || commentId <= 0) return notFound;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      projectId: true,
      documentId: true,
      documentVersionId: true,
      parentId: true,
      authorId: true,
      visibility: true,
      pagePath: true,
    },
  });
  if (!comment) return notFound;

  const member = await requireProjectRole(userId, comment.projectId, "COMMENTER");
  if (!member || !canViewComment(member, comment)) return notFound;

  const isOwn = comment.authorId === userId;
  const allowed =
    allow === "own" ? isOwn : isOwn || member.role === "AUTHOR";
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error:
        allow === "own"
          ? "Upravit nebo smazat můžete jen svůj komentář."
          : "Znovu připnout smí autor projektu nebo autor komentáře.",
    };
  }

  const latest = await latestVersionId(comment.documentId);
  if (comment.documentVersionId !== latest) {
    return {
      ok: false,
      status: 409,
      error: "Měnit lze jen komentáře v nejnovější verzi dokumentu.",
    };
  }

  return { ok: true, comment, member };
}
