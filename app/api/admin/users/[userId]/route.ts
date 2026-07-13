import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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

// Relace, jejichž existence brání smazání uživatele (autorský obsah + členství).
// Když jsou všechny prázdné, účet je „čistý" a smazání nic důležitého neztratí.
// Restrict relace (comments, versions, requirements…) by mazání stejně zablokovaly
// na úrovni DB — pre-check dává jen srozumitelnou hlášku místo 500.
const BLOCKING_COUNT = {
  memberships: true,
  createdProjects: true,
  createdClients: true,
  sentInvitations: true,
  uploadedVersions: true,
  comments: true,
  createdRequirements: true,
  approvedRequirements: true,
  // Po expert review: i vyřešené cizí komentáře blokují — jinak by smazání
  // tiše nastavilo resolvedById=NULL a v historii zmizelo „kdo vyřešil".
  resolvedComments: true,
} as const;

// Smazání uživatele — jen admin, jen účet BEZ projektů a autorského obsahu.
// Deaktivace je pro účty s obsahem; smazání pro prázdné (typicky testovací).
export async function DELETE(
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
  if (userId === admin.id) {
    return NextResponse.json(
      { error: "Sám sebe smazat nemůžete" },
      { status: 409 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: BLOCKING_COUNT } },
  });
  if (!target) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }
  // Živého admina (dle ADMIN_EMAILS) nelze smazat — nejdřív vyřadit z ENV.
  if (getAdminEmails().includes(target.email.toLowerCase())) {
    return NextResponse.json(
      { error: "Admina nelze smazat — nejdřív ho vyřaďte z ADMIN_EMAILS" },
      { status: 409 },
    );
  }

  const blocking = Object.values(target._count).reduce((a, b) => a + b, 0);
  if (blocking > 0) {
    return NextResponse.json(
      {
        error:
          "Uživatel má přiřazené projekty nebo vytvořený obsah. Nejdřív ho odeberte, nebo účet jen deaktivujte.",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Obrana do hloubky: kdyby mezi pre-checkem a mazáním vznikl obsah,
    // Restrict FK (P2003) vrátí 409 místo 500.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Uživatel má obsah — smazání není možné." },
        { status: 409 },
      );
    }
    throw e;
  }
}
