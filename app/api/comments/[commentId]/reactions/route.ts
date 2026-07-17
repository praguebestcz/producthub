import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionCreateSchema } from "@/lib/validation";
import { canViewComment } from "@/lib/comments/visibility";
import { rateLimit } from "@/lib/rate-limit";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";

// Reakce emoji na komentář — toggle (COMMENTER+). Když reakce daného emoji od
// uživatele existuje, smaže se; jinak vznikne. Přístup + viditelnost přesně dle
// vzoru status/route.ts (security review): nečlen i neinterní člen nad INTERNAL
// komentářem → 404 (neprozrazovat existenci).

const MAX_BODY_BYTES = 1_024;

export async function POST(
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
    select: { id: true, projectId: true, visibility: true },
  });
  if (!comment) {
    return NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 });
  }

  const member = await requireProjectRole(user.id, comment.projectId, "COMMENTER");
  // Nečlen i neinterní člen nad INTERNAL komentářem → 404 (nesmí prozradit
  // existenci interního komentáře).
  if (!member || !canViewComment(member, comment)) {
    return NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 });
  }

  // Rate-limit proti spamu reakcí (toggle jde mačkat opakovaně).
  const rl = rateLimit(`reaction:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho reakcí, chvíli počkejte." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Tělo se čte se stropem bajtů (ne přes content-length — chunked ji obejde).
  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Příliš velký požadavek" }, { status: 413 });
    }
    throw e;
  }
  const parsed = reactionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná reakce" }, { status: 400 });
  }
  const { emoji } = parsed.data;

  // Toggle bez race (security review): nejdřív zkus smazat; když nic nesmazáno,
  // vytvoř. Souběžné duplicitní create odchytíme jako idempotentní (P2002).
  const removed = await prisma.reaction.deleteMany({
    where: { commentId, userId: user.id, emoji },
  });
  if (removed.count > 0) {
    return NextResponse.json({ reacted: false });
  }
  try {
    await prisma.reaction.create({
      data: { commentId, userId: user.id, emoji },
    });
  } catch (e) {
    // Dvě paralelní stejné reakce → druhá spadne na unique. Idempotentní: OK.
    if (
      !(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
    ) {
      throw e;
    }
  }
  return NextResponse.json({ reacted: true });
}
