import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/notifications/read — označí notifikace přihlášeného jako přečtené.
// Bez `ids` označí VŠECHNY nepřečtené; s `ids` jen vyjmenované (vždy jen svoje,
// where hlídá userId — cizí id se nikdy nedotkne).

const schema = z.object({
  ids: z.array(z.number().int().positive()).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatný vstup" }, { status: 400 });
  }
  const { ids } = parsed.data;

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(ids ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
