import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientCreateSchema } from "@/lib/validation";

// Přejmenování a mazání klienta — POUZE canCreateProjects.
function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

async function parseClientId(params: Promise<{ clientId: string }>) {
  const id = Number((await params).clientId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.canCreateProjects) return forbidden();

  const clientId = await parseClientId(params);
  if (!clientId) {
    return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 });
  }

  const body = clientCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }

  const duplicate = await prisma.client.findFirst({
    where: {
      name: { equals: body.data.name, mode: "insensitive" },
      NOT: { id: clientId },
    },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `Klient „${duplicate.name}" už existuje` },
      { status: 409 },
    );
  }

  try {
    const client = await prisma.client.update({
      where: { id: clientId },
      data: { name: body.data.name },
      select: { id: true, name: true },
    });
    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.canCreateProjects) return forbidden();

  const clientId = await parseClientId(params);
  if (!clientId) {
    return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 });
  }

  try {
    await prisma.client.delete({ where: { id: clientId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Po expert review: Restrict (P2003) chytit a vrátit 409 — nespoléhat jen
    // na pre-check (race mezi kontrolou a mazáním).
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Klient má projekty — nejdřív je přesuňte nebo smažte" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 });
  }
}
