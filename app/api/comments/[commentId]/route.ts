import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidMentionIds } from "@/lib/comments/mentions";
import { signalCommentsChanged } from "@/lib/presence/hub";
import { loadCommentForAction, type CommentForAction } from "@/lib/comments/access";

// Úprava (PATCH) a smazání (DELETE) komentáře. Jen VLASTNÍ (authorId = session)
// a jen v NEJNOVĚJŠÍ verzi dokumentu (starší jsou read-only, M9). Kořen vlákna
// s odpověďmi nejde smazat (smazala by se i cizí diskuse) - lze upravit text.

const editSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  mentions: z.array(z.number().int().positive()).max(20).optional(),
});

// Společné kontroly (viditelnost, vlastnictví, read-only starší verze) žijí
// v lib/comments/access.ts — sdílí je i routa pro znovu připnutí. Tady se jen
// výsledek převede na odpověď.
async function guard(
  commentId: number,
  userId: number,
): Promise<
  { ok: true; comment: CommentForAction } | { ok: false; res: NextResponse }
> {
  const access = await loadCommentForAction(commentId, userId, "own");
  if (!access.ok) {
    return {
      ok: false,
      res: NextResponse.json({ error: access.error }, { status: access.status }),
    };
  }
  return { ok: true, comment: access.comment };
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
