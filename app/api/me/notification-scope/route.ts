import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/me/notification-scope — uživatel mění POUZE svou vlastní preferenci
// notifikací (userId ze session, nikdy z těla → žádný IDOR na cizí účet).

const schema = z.object({ notifyScope: z.enum(["ALL", "INVOLVED"]) });

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatný vstup" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { notifyScope: parsed.data.notifyScope },
  });
  return NextResponse.json({ notifyScope: parsed.data.notifyScope });
}
