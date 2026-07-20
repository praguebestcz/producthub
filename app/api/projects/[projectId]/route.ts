import { NextRequest, NextResponse } from "next/server";
import { canSeeInternal, getSessionUser, requireProjectRole } from "@/lib/auth";
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

  // Neinternímu členovi (klientovi) NEvracet e-maily členů, jejich „interní"
  // příznak ani `constraints` projektu (jde do AI promptů) — GDPR/PII + únik
  // organizační struktury (db-security-expert review 2026-07-20).
  const internal = canSeeInternal(member);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      clientId: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      ...(internal ? { constraints: true } : {}),
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          ...(internal ? { isInternal: true } : {}),
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              ...(internal ? { email: true } : {}),
            },
          },
        },
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

  // Po expert review (M3.5): změnu klienta smí jen canCreateProjects — AUTHOR
  // bez tohoto práva by jinak zkoušením clientId četl názvy cizích klientů.
  if (body.data.clientId !== undefined) {
    if (!user.canCreateProjects) {
      return NextResponse.json(
        { error: "Zařazení pod klienta smí měnit jen tým s právem zakládat projekty" },
        { status: 403 },
      );
    }
    if (body.data.clientId !== null) {
      const client = await prisma.client.findUnique({
        where: { id: body.data.clientId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: "Klient nenalezen" }, { status: 400 });
      }
    }
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: body.data,
    select: {
      id: true,
      name: true,
      description: true,
      constraints: true,
      clientId: true,
    },
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
