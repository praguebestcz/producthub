import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Zrušení čekající pozvánky — jen AUTHOR.
export async function DELETE(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; invitationId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { projectId: pid, invitationId: iid } = await params;
  const projectId = Number(pid);
  const invitationId = Number(iid);

  const member = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!member) {
    return NextResponse.json({ error: "Projekt nenalezen" }, { status: 404 });
  }

  // Mazat jde jen ČEKAJÍCÍ pozvánka tohoto projektu (přijaté drží historii).
  const { count } = await prisma.invitation.deleteMany({
    where: { id: invitationId, projectId, acceptedAt: null },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Pozvánka nenalezena" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
