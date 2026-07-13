import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signViewToken } from "@/lib/jwt";

// Vydá krátkodobý view token pro zobrazení konkrétní verze dokumentu.
// Členství se ověřuje tady i znovu ve view route (obrana do hloubky).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const versionId = Number((await params).versionId);
  if (!Number.isInteger(versionId) || versionId <= 0) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, entryPath: true, document: { select: { projectId: true } } },
  });
  if (!version) {
    return NextResponse.json({ error: "Verze nenalezena" }, { status: 404 });
  }
  const member = await requireProjectRole(
    user.id,
    version.document.projectId,
    "READER",
  );
  if (!member) {
    return NextResponse.json({ error: "Verze nenalezena" }, { status: 404 });
  }

  const token = await signViewToken(user.id, versionId);
  return NextResponse.json({ token, entryPath: version.entryPath });
}
