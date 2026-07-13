import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Přejmenování a smazání dokumentu — AUTHOR projektu.
// Přístup se ověřuje přes projekt dokumentu (join), ne přímo — nečlen dostane 404.

const patchSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název").max(200),
});

async function loadDocumentForAuthor(documentId: number, userId: number) {
  if (!Number.isInteger(documentId) || documentId <= 0) return null;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, projectId: true, name: true },
  });
  if (!document) return null;
  const member = await requireProjectRole(userId, document.projectId, "AUTHOR");
  if (!member) return null;
  return document;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const document = await loadDocumentForAuthor(documentId, user.id);
  if (!document) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }

  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { name: body.data.name },
    select: { id: true, name: true },
  });
  return NextResponse.json(updated);
}

// Smazání dokumentu (kaskáda smaže verze, assety i komentáře) — AUTHOR.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const document = await loadDocumentForAuthor(documentId, user.id);
  if (!document) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }
  await prisma.document.delete({ where: { id: documentId } });
  return NextResponse.json({ ok: true });
}
