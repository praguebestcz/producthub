import type { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canSeeInternal } from "@/lib/auth";

// Feed poslední aktivity pro dashboard (M-dashboard). Sloučí:
//  - nové komentáře / odpovědi / zmínky (dle createdAt),
//  - vyřešená vlákna (dle resolvedAt),
// napříč projekty uživatele, JEN v nejnovějších verzích dokumentů (M9 kopie
// nezdvojovat) a s respektem k viditelnosti interních (neinterní je nevidí).

export type ActivityKind = "comment" | "reply" | "mention" | "resolved";

export type ActivityItem = {
  key: string;
  kind: ActivityKind;
  actorName: string;
  actorAvatarUrl: string | null;
  projectName: string;
  documentName: string;
  projectId: number;
  documentId: number;
  rootCommentId: number;
  snippet: string;
  at: Date;
};

type Membership = { projectId: number; role: ProjectRole; isInternal: boolean };

export async function recentActivity(
  userId: number,
  members: Membership[],
  latestVersionIds: number[],
  limit = 8,
): Promise<ActivityItem[]> {
  if (latestVersionIds.length === 0) return [];
  const memberByProject = new Map(members.map((m) => [m.projectId, m]));
  const canInternal = (projectId: number) => {
    const m = memberByProject.get(projectId);
    return m ? canSeeInternal(m) : false;
  };

  // Nové komentáře/odpovědi (kořeny i odpovědi) na nejnovějších verzích.
  const comments = await prisma.comment.findMany({
    where: { documentVersionId: { in: latestVersionIds } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      parentId: true,
      projectId: true,
      documentId: true,
      authorId: true,
      body: true,
      visibility: true,
      createdAt: true,
      author: { select: { name: true, avatarUrl: true } },
      document: { select: { name: true, project: { select: { name: true } } } },
      mentions: { select: { userId: true } },
    },
  });

  // Nedávno vyřešená vlákna (kořeny) na nejnovějších verzích.
  const resolved = await prisma.comment.findMany({
    where: {
      documentVersionId: { in: latestVersionIds },
      parentId: null,
      status: "RESOLVED",
      resolvedAt: { not: null },
    },
    orderBy: { resolvedAt: "desc" },
    take: 15,
    select: {
      id: true,
      projectId: true,
      documentId: true,
      body: true,
      visibility: true,
      resolvedAt: true,
      resolvedBy: { select: { name: true, avatarUrl: true } },
      document: { select: { name: true, project: { select: { name: true } } } },
    },
  });

  const items: ActivityItem[] = [];

  for (const c of comments) {
    if (c.visibility === "INTERNAL" && !canInternal(c.projectId)) continue;
    const mentionedMe = c.authorId !== userId && c.mentions.some((m) => m.userId === userId);
    const kind: ActivityKind = mentionedMe
      ? "mention"
      : c.parentId === null
        ? "comment"
        : "reply";
    items.push({
      key: "c" + c.id,
      kind,
      actorName: c.author.name,
      actorAvatarUrl: c.author.avatarUrl,
      projectName: c.document.project.name,
      documentName: c.document.name,
      projectId: c.projectId,
      documentId: c.documentId,
      rootCommentId: c.parentId ?? c.id,
      snippet: c.body.slice(0, 100),
      at: c.createdAt,
    });
  }

  for (const c of resolved) {
    if (!c.resolvedAt) continue;
    if (c.visibility === "INTERNAL" && !canInternal(c.projectId)) continue;
    items.push({
      key: "r" + c.id,
      kind: "resolved",
      actorName: c.resolvedBy?.name ?? "Někdo",
      actorAvatarUrl: c.resolvedBy?.avatarUrl ?? null,
      projectName: c.document.project.name,
      documentName: c.document.name,
      projectId: c.projectId,
      documentId: c.documentId,
      rootCommentId: c.id,
      snippet: c.body.slice(0, 100),
      at: c.resolvedAt,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}

// Věta k aktivitě (za jménem aktéra). Rod neznáme → tvar „přidal(a)".
export function activityVerb(kind: ActivityKind): string {
  switch (kind) {
    case "comment":
      return "přidal(a) komentář";
    case "reply":
      return "odpověděl(a) ve vláknu";
    case "mention":
      return "vás zmínil(a)";
    case "resolved":
      return "vyřešil(a) vlákno";
  }
}
