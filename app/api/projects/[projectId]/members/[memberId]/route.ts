import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { memberPatchSchema } from "@/lib/validation";

// Změna role / interního příznaku a odebrání člena — jen AUTHOR.
// Pojistka: projekt nesmí zůstat bez autora (poslední AUTHOR je nedotknutelný).

function notFound() {
  return NextResponse.json({ error: "Projekt nenalezen" }, { status: 404 });
}

async function guard(
  params: Promise<{ projectId: string; memberId: string }>,
) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { projectId: pid, memberId: mid } = await params;
  const projectId = Number(pid);
  const memberId = Number(mid);
  const me = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!me) return { error: notFound() };

  const target = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });
  if (!target) {
    return { error: NextResponse.json({ error: "Člen nenalezen" }, { status: 404 }) };
  }
  return { projectId, target };
}

// Je cílový člen posledním autorem projektu?
async function isLastAuthor(projectId: number, target: { role: string }) {
  if (target.role !== "AUTHOR") return false;
  const authors = await prisma.projectMember.count({
    where: { projectId, role: "AUTHOR" },
  });
  return authors <= 1;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  const g = await guard(params);
  if ("error" in g) return g.error;

  const body = memberPatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }

  // Odebrání role AUTHOR poslednímu autorovi by projekt osiřelo.
  if (
    body.data.role &&
    body.data.role !== "AUTHOR" &&
    (await isLastAuthor(g.projectId, g.target))
  ) {
    return NextResponse.json(
      { error: "Projekt musí mít aspoň jednoho autora" },
      { status: 409 },
    );
  }

  const updated = await prisma.projectMember.update({
    where: { id: g.target.id },
    data: body.data,
    select: { id: true, role: true, isInternal: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  const g = await guard(params);
  if ("error" in g) return g.error;

  if (await isLastAuthor(g.projectId, g.target)) {
    return NextResponse.json(
      { error: "Projekt musí mít aspoň jednoho autora" },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.delete({ where: { id: g.target.id } });
    // Úklid přijaté pozvánky, aby šel člen později pozvat znovu (unikát projectId+email).
    const targetUser = await tx.user.findUnique({
      where: { id: g.target.userId },
      select: { email: true },
    });
    if (targetUser) {
      await tx.invitation.deleteMany({
        where: { projectId: g.projectId, email: targetUser.email },
      });
    }
  });
  return NextResponse.json({ ok: true });
}
