import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectPatchSchema } from "@/lib/validation";

// Nečlenům vracíme 404 (ne 403) — neprozrazovat existenci projektu.
function notFound() {
  return NextResponse.json({ error: "Projekt nenalezen" }, { status: 404 });
}

async function parseProjectId(params: Promise<{ projectId: string }>) {
  const id = Number((await params).projectId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Detail projektu — každý člen.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = await parseProjectId(params);
  if (!projectId) return notFound();

  const member = await requireProjectRole(user.id, projectId, "READER");
  if (!member) return notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { documents: true } },
    },
  });
  if (!project) return notFound();

  return NextResponse.json({ ...project, myRole: member.role });
}

// Úprava projektu (název, popis, omezení) — jen AUTHOR.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = await parseProjectId(params);
  if (!projectId) return notFound();

  const member = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!member) return notFound();

  const body = projectPatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: body.data,
    select: { id: true, name: true, description: true, constraints: true },
  });
  return NextResponse.json(project);
}

// Smazání projektu — jen AUTHOR. Kaskáda smaže dokumenty, komentáře i požadavky
// (UI vyžaduje výslovné potvrzení přes AlertDialog).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = await parseProjectId(params);
  if (!projectId) return notFound();

  const member = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!member) return notFound();

  await prisma.project.delete({ where: { id: projectId } });
  return NextResponse.json({ ok: true });
}
