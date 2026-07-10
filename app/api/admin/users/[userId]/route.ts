import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Změna oprávnění uživatele — jen pro adminy.
// V v1 jde měnit pouze `canCreateProjects`. Práva admina se přes API neměnit
// (bezpečnostní rozhodnutí: admin se nastavuje jen přes ADMIN_EMAILS).
const patchSchema = z.object({
  canCreateProjects: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await getSessionUser();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = Number((await params).userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Neplatný vstup" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { canCreateProjects: body.data.canCreateProjects },
      select: { id: true, canCreateProjects: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }
}
