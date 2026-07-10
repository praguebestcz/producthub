import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientCreateSchema } from "@/lib/validation";

// Klienti (složky projektů) — POUZE pro uživatele s canCreateProjects (tým PB).
// Po expert review: názvy klientů jsou obchodní informace, běžní členové je
// vidí jen u projektů, kde jsou členy (join), nikdy jako seznam.
function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.canCreateProjects) return forbidden();

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(
    clients.map((c) => ({
      id: c.id,
      name: c.name,
      projects: c._count.projects,
      createdAt: c.createdAt,
    })),
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.canCreateProjects) return forbidden();

  const body = clientCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }

  // Po expert review: case-insensitive kontrola duplicity („DDS" vs. „dds").
  const existing = await prisma.client.findFirst({
    where: { name: { equals: body.data.name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Klient „${existing.name}" už existuje` },
      { status: 409 },
    );
  }

  const client = await prisma.client.create({
    data: { name: body.data.name, createdById: user.id },
    select: { id: true, name: true },
  });
  return NextResponse.json(client, { status: 201 });
}
