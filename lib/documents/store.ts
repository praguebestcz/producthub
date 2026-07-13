import type { DocumentSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ImportResult } from "./zip-import";

// Uloží importovaný balík jako novou verzi dokumentu (nebo nový dokument).
// VŠE (dokument + verze + assety) v jedné transakci — po expert/code review:
// při selhání uprostřed ukládání assetů se všechno vrátí zpět, nevznikne
// „poloviční" dokument bez vstupní stránky. Assety se vkládají po dávkách.
const ASSET_BATCH = 50;
// Import může být větší (desítky souborů) — velkorysejší časový limit transakce.
const TX_OPTS = { timeout: 30_000, maxWait: 10_000 } as const;

async function insertAssets(
  tx: Prisma.TransactionClient,
  versionId: number,
  result: ImportResult,
) {
  for (let i = 0; i < result.files.length; i += ASSET_BATCH) {
    const batch = result.files.slice(i, i + ASSET_BATCH);
    await tx.asset.createMany({
      data: batch.map((f) => ({
        documentVersionId: versionId,
        path: f.path,
        contentType: f.contentType,
        size: f.size,
        // Prisma Bytes očekává Uint8Array — Buffer zabalíme do čisté kopie.
        data: new Uint8Array(f.data),
      })),
    });
  }
}

// Nový dokument v projektu s první verzí.
export async function createDocument(opts: {
  projectId: number;
  name: string;
  userId: number;
  source: DocumentSource;
  sourceUrl?: string | null;
  result: ImportResult;
}): Promise<{ documentId: number; versionId: number }> {
  return prisma.$transaction(async (tx) => {
    const maxOrder = await tx.document.aggregate({
      where: { projectId: opts.projectId },
      _max: { sortOrder: true },
    });
    const document = await tx.document.create({
      data: {
        projectId: opts.projectId,
        name: opts.name,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
    const version = await tx.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        entryPath: opts.result.entryPath,
        source: opts.source,
        sourceUrl: opts.sourceUrl ?? null,
        uploadedById: opts.userId,
      },
    });
    await insertAssets(tx, version.id, opts.result);
    return { documentId: document.id, versionId: version.id };
  }, TX_OPTS);
}

// Nová verze existujícího dokumentu (versionNumber = max + 1).
export async function createVersion(opts: {
  documentId: number;
  userId: number;
  source: DocumentSource;
  sourceUrl?: string | null;
  result: ImportResult;
}): Promise<{ versionId: number; versionNumber: number }> {
  return prisma.$transaction(async (tx) => {
    const max = await tx.documentVersion.aggregate({
      where: { documentId: opts.documentId },
      _max: { versionNumber: true },
    });
    const versionNumber = (max._max.versionNumber ?? 0) + 1;
    const version = await tx.documentVersion.create({
      data: {
        documentId: opts.documentId,
        versionNumber,
        entryPath: opts.result.entryPath,
        source: opts.source,
        sourceUrl: opts.sourceUrl ?? null,
        uploadedById: opts.userId,
      },
    });
    await insertAssets(tx, version.id, opts.result);
    // Document.updatedAt se obnoví @updatedAt při jakékoli změně dokumentu;
    // verze je samostatná tabulka, proto dotek dokumentu explicitně.
    await tx.document.update({
      where: { id: opts.documentId },
      data: { updatedAt: new Date() },
    });
    return { versionId: version.id, versionNumber };
  }, TX_OPTS);
}
