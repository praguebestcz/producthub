import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectCreateSchema } from "@/lib/validation";

// Seznam projektů přihlášeného uživatele (jen ty, kde je členem).
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          _count: { select: { members: true, documents: true } },
        },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      role: m.role,
      members: m.project._count.members,
      documents: m.project._count.documents,
      updatedAt: m.project.updatedAt,
    })),
  );
}

// Založení projektu — jen uživatelé s canCreateProjects.
// Zakladatel se stává členem s rolí AUTHOR (interní).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.canCreateProjects) {
    return NextResponse.json(
      { error: "Nemáte oprávnění zakládat projekty" },
      { status: 403 },
    );
  }

  const body = projectCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }

  // Zařazení pod klienta — klient musí existovat.
  if (body.data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: body.data.clientId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Klient nenalezen" }, { status: 400 });
    }
  }

  const project = await prisma.project.create({
    data: {
      name: body.data.name,
      description: body.data.description || null,
      clientId: body.data.clientId ?? null,
      createdById: user.id,
      members: {
        create: { userId: user.id, role: "AUTHOR", isInternal: true },
      },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(project, { status: 201 });
}
