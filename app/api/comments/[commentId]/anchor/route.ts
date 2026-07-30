import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentAnchorSchema } from "@/lib/validation";
import { loadCommentForAction } from "@/lib/comments/access";
import { signalCommentsChanged } from "@/lib/presence/hub";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// M9 v1.1 — znovu připnutí komentáře na jiný prvek. Po nahrání nové verze
// může kotva osiřet (prvek přejmenovaný, přesunutý, zrušený); tahle routa ji
// nastaví na prvek, který uživatel vybral v prohlížeči.
//
// Smí autor projektu NEBO autor komentáře (rozhodnutí Hany): kotvy po
// re-uploadu rovná zpravidla ten, kdo verzi nahrál — klient se k rozbitému
// komentáři vracet nemusí. Zbytek pravidel (viditelnost 404, read-only starší
// verze 409) je v lib/comments/access.ts.

const MAX_BODY_BYTES = 65_536;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commentId = Number((await params).commentId);
  const access = await loadCommentForAction(commentId, user.id, "ownOrProjectAuthor");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { comment } = access;

  // Kotvu nese jen kořen vlákna (odpovědi dědí stránku i prvek).
  if (comment.parentId !== null) {
    return NextResponse.json(
      { error: "Znovu připnout lze jen celé vlákno, ne jednotlivou odpověď." },
      { status: 400 },
    );
  }

  const rl = rateLimit(`repin:${user.id}`, 30, 60_000);
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
  const parsed = commentAnchorSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const a = parsed.data;

  // Jeden prvek = jedno vlákno: na cílovém prvku nesmí být jiné vlákno téže
  // verze (jinak by na jednom místě seděly dva špendlíky přes sebe).
  const clash = await prisma.comment.findFirst({
    where: {
      id: { not: comment.id },
      documentId: comment.documentId,
      documentVersionId: comment.documentVersionId,
      pagePath: a.pagePath,
      parentId: null,
      ...(a.dataReviewId
        ? { dataReviewId: a.dataReviewId }
        : { dataReviewId: null, domPath: a.domPath }),
    },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: "Na tomto prvku už jedno vlákno je. Vyberte jiný prvek." },
      { status: 409 },
    );
  }

  // Kotva + stránka kořene; odpovědi dědí stránku kořene (viz comment-transfer),
  // takže při připnutí na JINOU stránku se musí přerovnat taky.
  await prisma.$transaction([
    prisma.comment.update({
      where: { id: comment.id },
      data: {
        pagePath: a.pagePath,
        dataReviewId: a.dataReviewId ?? null,
        domPath: a.domPath ?? null,
        elementHtml: a.elementHtml ?? null,
        viewportWidth: a.viewportWidth ?? null,
        viewportHeight: a.viewportHeight ?? null,
        isOrphaned: false,
      },
    }),
    prisma.comment.updateMany({
      where: { parentId: comment.id },
      data: { pagePath: a.pagePath },
    }),
  ]);

  signalCommentsChanged(comment.documentId);
  return NextResponse.json({ ok: true });
}
