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
import { createDocument } from "@/lib/documents/store";

function notFound() {
  return NextResponse.json({ error: "Projekt nenalezen" }, { status: 404 });
}

// Seznam dokumentů projektu — každý člen.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = Number((await params).projectId);
  const member = await requireProjectRole(user.id, projectId, "READER");
  if (!member) return notFound();

  const documents = await prisma.document.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { versions: true } } },
  });
  return NextResponse.json(documents);
}

// Nahrání / import nového dokumentu — AUTHOR (kdo spravuje obsah projektu).
// Přijímá multipart (soubor .html/.zip) nebo JSON { url }.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projectId = Number((await params).projectId);
  const member = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!member) return notFound();

  const contentType = req.headers.get("content-type") ?? "";

  try {
    let prepared;
    let name: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Chybí soubor" },
          { status: 400 },
        );
      }
      name = (form.get("name") as string | null)?.trim() || undefined;
      prepared = await prepareFromFile(file);
    } else {
      // URL import — rate-limit (drahé, SSRF-citlivé).
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

    const created = await createDocument({
      projectId,
      name: (name || prepared.suggestedName || "Dokument").slice(0, 200),
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
    console.error("Import dokumentu selhal:", e);
    return NextResponse.json(
      { error: "Import se nepodařil" },
      { status: 500 },
    );
  }
}
