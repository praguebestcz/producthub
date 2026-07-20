import { NextRequest, NextResponse } from "next/server";
import { canSeeInternal, getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promptExportStatusSchema } from "@/lib/validation";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";

// Změna stavu zadání (M8): Vytvořeno → Předáno vývoji → Zapracováno.
// Gate: interní člen projektu (COMMENTER+), jinak 404 — jako list/create.

const MAX_BODY_BYTES = 1_024;

// PATCH /api/prompt-exports/[exportId] — { status }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const exportId = Number((await params).exportId);
  if (!Number.isInteger(exportId) || exportId <= 0) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const record = await prisma.promptExport.findUnique({
    where: { id: exportId },
    select: { id: true, document: { select: { projectId: true } } },
  });
  if (!record) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  const member = await requireProjectRole(
    user.id,
    record.document.projectId,
    "COMMENTER",
  );
  if (!member || !canSeeInternal(member)) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Neplatný vstup" }, { status: 413 });
    }
    throw e;
  }

  const parsed = promptExportStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }

  await prisma.promptExport.update({
    where: { id: exportId },
    data: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/prompt-exports/[exportId] — smazat zadání.
// Smí autor zadání NEBO autor projektu (interní tým).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const exportId = Number((await params).exportId);
  if (!Number.isInteger(exportId) || exportId <= 0) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const record = await prisma.promptExport.findUnique({
    where: { id: exportId },
    select: {
      id: true,
      createdById: true,
      document: { select: { projectId: true } },
    },
  });
  if (!record) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  const member = await requireProjectRole(
    user.id,
    record.document.projectId,
    "COMMENTER",
  );
  if (!member || !canSeeInternal(member)) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  // Smazat smí jen autor zadání nebo autor projektu (ne každý interní člen).
  if (record.createdById !== user.id && member.role !== "AUTHOR") {
    return NextResponse.json(
      { error: "Smazat zadání může jen jeho autor nebo autor projektu." },
      { status: 403 },
    );
  }

  await prisma.promptExport.delete({ where: { id: exportId } });
  return NextResponse.json({ ok: true });
}
