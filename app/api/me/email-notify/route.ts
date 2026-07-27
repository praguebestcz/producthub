import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/me/email-notify — uživatel mění POUZE svou vlastní volbu e-mailových
// notifikací (userId ze session, nikdy z těla → žádný IDOR na cizí účet).

const schema = z.object({
  emailNotify: z.enum(["OFF", "IMMEDIATE", "UNREAD"]),
});

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
    data: { emailNotify: parsed.data.emailNotify },
  });
  return NextResponse.json({ emailNotify: parsed.data.emailNotify });
}
