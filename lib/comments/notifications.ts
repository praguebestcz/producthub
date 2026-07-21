import type { NotificationType, Prisma, ProjectRole } from "@prisma/client";
import { canSeeInternal } from "@/lib/auth";

// Vznik notifikací (zvoneček, M7). SDÍLENÝ s filtrem viditelnosti —
// notifikace jsou 3. kanál úniku interních komentářů (vedle REST a SSE),
// takže interní komentář smí vygenerovat notifikaci JEN internímu příjemci.

// Preference notifikací uživatele. ALL = veškeré dění v dokumentech projektů;
// INVOLVED = jen když je zapojen (zmínka NEBO odpověď/změna stavu v jeho vláknu).
// Zrcadlí enum NotifyScope ze schématu (bez importu @prisma kvůli testům).
export type NotifyScope = "ALL" | "INVOLVED";

// Členství potřebné k výpočtu příjemce (role + interní příznak + zda deaktivovaný).
export type RecipientMemberInfo = {
  role: ProjectRole;
  isInternal: boolean;
  deactivated: boolean;
};

// Čistá funkce (testovatelná bez DB): z kandidátů a zmínek spočítá příjemce.
// Pravidla:
//  - NIKDY aktérovi (sám sebe neupozorňuje),
//  - jen aktivním členům projektu,
//  - interní komentář → jen internímu příjemci (canSeeInternal),
//  - dedup: max. jedna notifikace na příjemce; zmínka přebíjí základní typ,
//  - preference INVOLVED: příjemce NEDOSTANE „nový kořenový komentář" (NEW_COMMENT),
//    kde je jen členem projektu, POKUD není zároveň zmíněn. Odpovědi / změny stavu
//    (účastník vlákna) a zmínky chodí vždy. Preference NEMĚNÍ filtr viditelnosti.
export function computeRecipients(opts: {
  candidateUserIds: number[];
  mentionedUserIds: number[];
  baseType: NotificationType;
  isInternalComment: boolean;
  actorId: number;
  memberIndex: Map<number, RecipientMemberInfo>;
  scopeIndex?: Map<number, NotifyScope>;
}): { userId: number; type: NotificationType }[] {
  const {
    candidateUserIds,
    mentionedUserIds,
    baseType,
    isInternalComment,
    actorId,
    memberIndex,
    scopeIndex,
  } = opts;

  const out = new Map<number, NotificationType>();

  const consider = (userId: number, type: NotificationType) => {
    if (userId === actorId) return;
    const info = memberIndex.get(userId);
    if (!info || info.deactivated) return;
    if (isInternalComment && !canSeeInternal(info)) return;
    // Preference INVOLVED: „nový kořenový komentář" (jen členství) nechodí.
    // MENTION i odpovědi/změny stavu (účastník) chodí vždy → key jen NEW_COMMENT.
    if (type === "NEW_COMMENT" && scopeIndex?.get(userId) === "INVOLVED") return;
    // Zmínku už nepřebíjí základní typ (mention má přednost).
    if (out.get(userId) === "MENTION") return;
    out.set(userId, type);
  };

  for (const userId of candidateUserIds) consider(userId, baseType);
  for (const userId of mentionedUserIds) consider(userId, "MENTION");

  return [...out.entries()].map(([userId, type]) => ({ userId, type }));
}

// Založí notifikace pro událost nad komentářem. Volá se UVNITŘ transakce
// společně se zápisem komentáře/změny stavu (spec M7 — atomicky).
//  - scope "ALL_MEMBERS": nový kořenový komentář → všem členům projektu
//  - scope "PARTICIPANTS": odpověď / změna stavu → účastníkům vlákna
export async function createCommentNotifications(
  tx: Prisma.TransactionClient,
  opts: {
    projectId: number;
    commentId: number; // komentář, na který notifikace odkazuje
    rootId: number; // kořen vlákna (pro dohledání účastníků)
    actorId: number;
    baseType: NotificationType;
    isInternalComment: boolean;
    mentionedUserIds: number[];
    scope: "ALL_MEMBERS" | "PARTICIPANTS";
  },
): Promise<void> {
  const members = await tx.projectMember.findMany({
    where: { projectId: opts.projectId },
    select: {
      userId: true,
      role: true,
      isInternal: true,
      user: { select: { deactivatedAt: true, notifyScope: true } },
    },
  });
  const memberIndex = new Map<number, RecipientMemberInfo>();
  const scopeIndex = new Map<number, NotifyScope>();
  for (const m of members) {
    memberIndex.set(m.userId, {
      role: m.role,
      isInternal: m.isInternal,
      deactivated: m.user.deactivatedAt !== null,
    });
    scopeIndex.set(m.userId, m.user.notifyScope);
  }

  let candidateUserIds: number[];
  if (opts.scope === "ALL_MEMBERS") {
    candidateUserIds = members.map((m) => m.userId);
  } else {
    // Účastníci vlákna = autor kořene + autoři odpovědí (nová odpověď je už
    // zapsaná, takže její autor tu je — vyřadí se jako aktér).
    const participants = await tx.comment.findMany({
      where: { OR: [{ id: opts.rootId }, { parentId: opts.rootId }] },
      select: { authorId: true },
    });
    candidateUserIds = [...new Set(participants.map((p) => p.authorId))];
  }

  const recipients = computeRecipients({
    candidateUserIds,
    mentionedUserIds: opts.mentionedUserIds,
    baseType: opts.baseType,
    isInternalComment: opts.isInternalComment,
    actorId: opts.actorId,
    memberIndex,
    scopeIndex,
  });

  if (recipients.length === 0) return;
  await tx.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.userId,
      type: r.type,
      projectId: opts.projectId,
      commentId: opts.commentId,
      actorId: opts.actorId,
    })),
  });
}
