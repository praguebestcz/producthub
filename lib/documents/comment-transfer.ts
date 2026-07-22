import { prisma } from "@/lib/prisma";

// Přenos komentářů mezi verzemi (M9). Zkopíruje NEVYŘEŠENÁ kořenová vlákna
// (status OPEN/REOPENED) + jejich odpovědi + zmínky z předchozí verze do nové.
// Kotva se zachová; `isOrphaned` = stránka komentáře v nové verzi NEexistuje
// (Stupeň 1 - existence stránky; připnutí na prvek řeší overlay za běhu).
// Vyřešená vlákna a reakce emoji se NEkopírují. Volá se PO vzniku verze v
// SAMOSTATNÉ transakci - případná chyba nezablokuje vznik verze.
export async function transferUnresolvedComments(opts: {
  documentId: number;
  newVersionId: number;
  newVersionNumber: number;
  pagePaths: Set<string>; // cesty souborů nové verze (pro existenci stránky)
}): Promise<number> {
  // Předchozí verze = nejvyšší versionNumber pod novou.
  const prev = await prisma.documentVersion.findFirst({
    where: {
      documentId: opts.documentId,
      versionNumber: { lt: opts.newVersionNumber },
    },
    orderBy: { versionNumber: "desc" },
    select: { id: true },
  });
  if (!prev) return 0;

  const roots = await prisma.comment.findMany({
    where: {
      documentVersionId: prev.id,
      parentId: null,
      status: { not: "RESOLVED" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      projectId: true,
      documentId: true,
      pagePath: true,
      authorId: true,
      body: true,
      visibility: true,
      status: true,
      dataReviewId: true,
      domPath: true,
      elementHtml: true,
      viewportWidth: true,
      viewportHeight: true,
      createdAt: true,
      mentions: { select: { userId: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          authorId: true,
          body: true,
          visibility: true,
          createdAt: true,
          mentions: { select: { userId: true } },
        },
      },
    },
  });
  if (roots.length === 0) return 0;

  await prisma.$transaction(
    async (tx) => {
      for (const r of roots) {
        const newRoot = await tx.comment.create({
          data: {
            projectId: r.projectId,
            documentId: r.documentId,
            documentVersionId: opts.newVersionId,
            pagePath: r.pagePath,
            authorId: r.authorId,
            body: r.body,
            visibility: r.visibility,
            status: r.status,
            dataReviewId: r.dataReviewId,
            domPath: r.domPath,
            elementHtml: r.elementHtml,
            viewportWidth: r.viewportWidth,
            viewportHeight: r.viewportHeight,
            isOrphaned: !opts.pagePaths.has(r.pagePath),
            createdAt: r.createdAt, // zachovat čas původního komentáře
          },
          select: { id: true },
        });
        if (r.mentions.length > 0) {
          await tx.mention.createMany({
            data: r.mentions.map((m) => ({
              commentId: newRoot.id,
              userId: m.userId,
            })),
            skipDuplicates: true,
          });
        }
        for (const rep of r.replies) {
          const newRep = await tx.comment.create({
            data: {
              projectId: r.projectId,
              documentId: r.documentId,
              documentVersionId: opts.newVersionId,
              pagePath: r.pagePath, // odpověď dědí stránku kořene
              authorId: rep.authorId,
              parentId: newRoot.id,
              body: rep.body,
              visibility: rep.visibility,
              createdAt: rep.createdAt,
            },
            select: { id: true },
          });
          if (rep.mentions.length > 0) {
            await tx.mention.createMany({
              data: rep.mentions.map((m) => ({
                commentId: newRep.id,
                userId: m.userId,
              })),
              skipDuplicates: true,
            });
          }
        }
      }
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  return roots.length;
}
