import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getAdminEmails } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// Změna oprávnění a deaktivace uživatele — jen pro adminy.
// V v1 jde měnit `canCreateProjects` a `deactivated`. Práva admina se přes API
// neměnit (bezpečnostní rozhodnutí: admin se nastavuje jen přes ADMIN_EMAILS).
const patchSchema = z
  .object({
    canCreateProjects: z.boolean().optional(),
    deactivated: z.boolean().optional(),
  })
  .refine(
    (v) => v.canCreateProjects !== undefined || v.deactivated !== undefined,
    { message: "Nic ke změně" },
  );

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

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  if (body.data.deactivated !== undefined) {
    // Sám sebe deaktivovat nejde (zamčení se ven).
    if (target.id === admin.id) {
      return NextResponse.json(
        { error: "Sám sebe deaktivovat nemůžete" },
        { status: 409 },
      );
    }
    // Po expert review: ŽIVÉHO admina (dle ADMIN_EMAILS, ne DB flagu) nejde
    // deaktivovat — ex-admin vyřazený z ENV deaktivovat jde.
    if (
      body.data.deactivated &&
      getAdminEmails().includes(target.email.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Admina nelze deaktivovat — nejdřív ho vyřaďte z ADMIN_EMAILS" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.data.canCreateProjects !== undefined
        ? { canCreateProjects: body.data.canCreateProjects }
        : {}),
      ...(body.data.deactivated !== undefined
        ? body.data.deactivated
          ? // Po expert review: bump tokenValidFrom zabíjí session (i na proxy)
            // a view tokeny okamžitě.
            { deactivatedAt: new Date(), tokenValidFrom: new Date() }
          : // Reaktivace tokenValidFrom NEvrací — staré session nesmí obživnout.
            { deactivatedAt: null }
        : {}),
    },
    select: { id: true, canCreateProjects: true, deactivatedAt: true },
  });
  return NextResponse.json(updated);
}
