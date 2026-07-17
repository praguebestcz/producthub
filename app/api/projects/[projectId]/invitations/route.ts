import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invitationCreateSchema } from "@/lib/validation";

function notFound() {
  return NextResponse.json({ error: "Projekt nenalezen" }, { status: 404 });
}

// Čekající pozvánky projektu — jen AUTHOR.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = Number((await params).projectId);
  const member = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!member) return notFound();

  const invitations = await prisma.invitation.findMany({
    where: { projectId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, isInternal: true, createdAt: true },
  });
  return NextResponse.json(invitations);
}

// Pozvání do projektu — jen AUTHOR.
// Když už uživatel s e-mailem existuje, členem se stává OKAMŽITĚ (pozvánka se
// rovnou označí jako přijatá). Jinak čeká na první přihlášení Googlem.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = Number((await params).projectId);
  const member = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!member) return notFound();

  const body = invitationCreateSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const { email, role, isInternal } = body.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: existingUser.id } },
    });
    if (existingMember) {
      return NextResponse.json(
        { error: "Tento uživatel už je členem projektu" },
        { status: 409 },
      );
    }
  }

  const existingInvitation = await prisma.invitation.findUnique({
    where: { projectId_email: { projectId, email } },
  });
  if (existingInvitation && !existingInvitation.acceptedAt) {
    return NextResponse.json(
      { error: "Na tento e-mail už pozvánka čeká" },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
    // Upsert kvůli dřívější přijaté pozvánce (unikát projectId+email) —
    // člen mohl být mezitím odebrán a pozván znovu.
    await tx.invitation.upsert({
      where: { projectId_email: { projectId, email } },
      create: {
        projectId,
        email,
        role,
        isInternal,
        invitedById: user.id,
        acceptedAt: existingUser ? new Date() : null,
      },
      update: {
        role,
        isInternal,
        invitedById: user.id,
        createdAt: new Date(),
        acceptedAt: existingUser ? new Date() : null,
      },
    });
    if (existingUser) {
      await tx.projectMember.create({
        data: { projectId, userId: existingUser.id, role, isInternal },
      });
    }
    });
  } catch (e) {
    // Souběh: mezi kontrolou členství a create se stal členem (unique
    // projectId+userId) → čitelná 409 místo neošetřeného 500 (security review).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Tento uživatel už je členem projektu" },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json(
    {
      ok: true,
      immediate: !!existingUser,
    },
    { status: 201 },
  );
}
