import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewComment } from "@/lib/comments/visibility";
import { invalidMentionIds } from "@/lib/comments/mentions";
import { signalCommentsChanged } from "@/lib/presence/hub";
import { latestVersionId } from "@/lib/documents/store";

// Úprava (PATCH) a smazání (DELETE) komentáře. Jen VLASTNÍ (authorId = session)
// a jen v NEJNOVĚJŠÍ verzi dokumentu (starší jsou read-only, M9). Kořen vlákna
// s odpověďmi nejde smazat (smazala by se i cizí diskuse) - lze upravit text.

const editSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  mentions: z.array(z.number().int().positive()).max(20).optional(),
});

async function loadOwnComment(commentId: number, userId: number) {
  if (!Number.isInteger(commentId) || commentId <= 0) return null;
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
    },
  });
  if (!comment) return null;
  const member = await requireProjectRole(userId, comment.projectId, "COMMENTER");
  // Nečlen i neinterní člen nad INTERNAL vláknem → 404 (neprozrazovat existenci).
  if (!member || !canViewComment(member, comment)) return null;
  return { comment };
}

// Společné kontroly vlastnictví + read-only verze.
async function guard(
  commentId: number,
  userId: number,
): Promise<
  | { ok: true; comment: NonNullable<Awaited<ReturnType<typeof loadOwnComment>>>["comment"] }
  | { ok: false; res: NextResponse }
> {
  const ctx = await loadOwnComment(commentId, userId);
  if (!ctx) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 }),
    };
  }
  if (ctx.comment.authorId !== userId) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Upravit nebo smazat můžete jen svůj komentář." },
        { status: 403 },
      ),
    };
  }
  const latest = await latestVersionId(ctx.comment.documentId);
  if (ctx.comment.documentVersionId !== latest) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Upravit lze jen komentáře v nejnovější verzi dokumentu." },
        { status: 409 },
      ),
    };
  }
  return { ok: true, comment: ctx.comment };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const commentId = Number((await params).commentId);
  const g = await guard(commentId, user.id);
  if (!g.ok) return g.res;

  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const { body, mentions } = parsed.data;

  // Zmínky jen na členy projektu (stejně jako u vzniku komentáře).
  if (mentions && mentions.length > 0) {
    const members = await prisma.projectMember.findMany({
      where: {
        projectId: g.comment.projectId,
        userId: { in: mentions },
        user: { deactivatedAt: null },
      },
      select: { userId: true },
    });
    if (invalidMentionIds(mentions, members.map((m) => m.userId)).length > 0) {
      return NextResponse.json(
        { error: "Zmínit lze jen členy projektu" },
        { status: 400 },
      );
    }
  }

  // Atomicky: text (+ re-sync zmínek JEN když je pole `mentions` posláno — úprava
  // jen textu tak zmínky zachová). Úprava NEgeneruje notifikace (aby nespamovala);
  // viditelnost komentáře se nemění.
  await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: { body } });
    if (mentions !== undefined) {
      await tx.mention.deleteMany({ where: { commentId } });
      if (mentions.length > 0) {
        await tx.mention.createMany({
          data: mentions.map((userId) => ({ commentId, userId })),
          skipDuplicates: true,
        });
      }
    }
  });

  signalCommentsChanged(g.comment.documentId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const commentId = Number((await params).commentId);
  const g = await guard(commentId, user.id);
  if (!g.ok) return g.res;

  // Kořen s odpověďmi nemazat - smazala by se i cizí diskuse (kaskáda). Autor
  // může upravit text; smazat jde jen vlákno bez odpovědí nebo vlastní odpověď.
  if (g.comment.parentId === null) {
    const replies = await prisma.comment.count({ where: { parentId: commentId } });
    if (replies > 0) {
      return NextResponse.json(
        {
          error:
            "Vlákno s odpověďmi nejde smazat (smazala by se i cizí diskuse). Text můžete upravit.",
        },
        { status: 409 },
      );
    }
  }

  await prisma.comment.delete({ where: { id: commentId } });
  signalCommentsChanged(g.comment.documentId);
  return NextResponse.json({ ok: true });
}
