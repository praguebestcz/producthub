import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { ImportError } from "@/lib/documents/zip-import";
import {
  prepareFromFile,
  prepareFromUrl,
  urlImportSchema,
} from "@/lib/documents/build-input";
import { createVersion } from "@/lib/documents/store";

// Nahrání nové verze existujícího dokumentu — AUTHOR projektu.
// Stejné vstupy jako u nového dokumentu (soubor / ZIP / URL).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = Number((await params).documentId);
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, projectId: true },
  });
  if (!document) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }
  const member = await requireProjectRole(user.id, document.projectId, "AUTHOR");
  if (!member) {
    return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  try {
    let prepared;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });
      }
      prepared = await prepareFromFile(file);
    } else {
      const rl = rateLimit(`import:${user.id}`, 10, 60 * 60 * 1000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: `Příliš mnoho importů. Zkuste to za ${rl.retryAfterSec} s.` },
          { status: 429 },
        );
      }
      const body = urlImportSchema.safeParse(await req.json().catch(() => null));
      if (!body.success) {
        return NextResponse.json(
          { error: body.error.issues[0]?.message ?? "Neplatný vstup" },
          { status: 400 },
        );
      }
      prepared = await prepareFromUrl(body.data.url);
    }

    const created = await createVersion({
      documentId,
      userId: user.id,
      source: prepared.source,
      sourceUrl: prepared.sourceUrl,
      result: prepared.result,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Nová verze selhala:", e);
    return NextResponse.json({ error: "Import se nepodařil" }, { status: 500 });
  }
}
