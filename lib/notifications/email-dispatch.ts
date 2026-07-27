import type { EmailNotify } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isNotificationDeliverable } from "./eligibility";
import { sendEmail } from "@/lib/email/send";
import {
  buildNotificationEmail,
  type NotificationEmailItem,
} from "@/lib/email/notification-email";

// Odešle e-maily pro dané notifikace v daném režimu. Sdílené IMMEDIATE (po
// vzniku, fire-and-forget) i úlohou na pozadí (UNREAD sweep). Všechny podmínky
// ze security review:
//  - atomický claim `emailedAt` (updateMany where emailedAt IS NULL) → žádné dvojí odeslání,
//  - čerstvý re-check členství/viditelnosti/deaktivace (sdílený se zvonečkem),
//  - seskupení víc notifikací příjemce do jednoho e-mailu (méně e-mailů),
//  - při selhání odeslání kompenzace (emailedAt zpět NULL) → sweep to zkusí znovu
//    (v okně 24 h; starší už sweep nebere, takže se to nezacyklí),
//  - do logu nikdy nejde obsah komentáře.
const SNIPPET_LEN = 100;

export async function dispatchNotificationEmails(
  notificationIds: number[],
  mode: EmailNotify, // "IMMEDIATE" | "UNREAD" (OFF sem nikdy nechodí)
): Promise<void> {
  if (notificationIds.length === 0) return;

  const notifs = await prisma.notification.findMany({
    where: { id: { in: notificationIds }, emailedAt: null },
    select: {
      id: true,
      userId: true,
      type: true,
      projectId: true,
      user: {
        select: { email: true, emailNotify: true, deactivatedAt: true },
      },
      actor: { select: { name: true } },
      project: { select: { name: true } },
      comment: {
        select: {
          id: true,
          parentId: true,
          visibility: true,
          body: true,
          documentId: true,
          document: { select: { name: true } },
        },
      },
    },
  });
  if (notifs.length === 0) return;

  // Zpracují se jen notifikace, jejichž příjemce má PRÁVĚ TEĎ zvolený tento
  // režim a není deaktivovaný (rozhoduje stav v čase odeslání).
  const relevant = notifs.filter(
    (n) => n.user.emailNotify === mode && n.user.deactivatedAt === null,
  );
  if (relevant.length === 0) return;

  // Čerstvé členství příjemců v projektech notifikací (jeden dotaz).
  const memberships = await prisma.projectMember.findMany({
    where: {
      userId: { in: [...new Set(relevant.map((n) => n.userId)) ] },
      projectId: { in: [...new Set(relevant.map((n) => n.projectId))] },
    },
    select: { userId: true, projectId: true, role: true, isInternal: true },
  });
  const memberIndex = new Map(
    memberships.map((m) => [`${m.userId}:${m.projectId}`, m]),
  );

  // Zabookuje jednu notifikaci (atomicky). Vrací true, když ji zabookoval TENTO
  // běh (jinak už ji vzal někdo jiný / je odeslaná).
  const claim = async (id: number): Promise<boolean> => {
    const res = await prisma.notification.updateMany({
      where: { id, emailedAt: null },
      data: { emailedAt: new Date() },
    });
    return res.count === 1;
  };

  // Seskupení odesílatelných položek podle příjemce (jeden e-mail na příjemce).
  const perUser = new Map<
    number,
    { email: string; ids: number[]; items: NotificationEmailItem[] }
  >();

  // Notifikace vázané na komentář (u nich musí komentář existovat). Ostatní
  // (požadavek / pozvánka) komentář nemají a je to v pořádku.
  const COMMENT_TYPES = [
    "NEW_COMMENT",
    "NEW_REPLY",
    "MENTION",
    "COMMENT_STATUS_CHANGED",
  ];

  for (const n of relevant) {
    const member = memberIndex.get(`${n.userId}:${n.projectId}`);
    const deliverable = isNotificationDeliverable({
      member,
      commentVisibility: n.comment?.visibility ?? null,
      commentMissing: COMMENT_TYPES.includes(n.type) && n.comment === null,
    });

    // Zabookovat musíme VŽDY (i nedoručitelné) - u nedoručitelných tím řekneme
    // „vyřízeno, neposílat", ať to sweep nevyhodnocuje donekonečna.
    const claimed = await claim(n.id);
    if (!claimed) continue; // vzal někdo jiný
    if (!deliverable) continue; // zabookováno bez odeslání

    const entry = perUser.get(n.userId) ?? {
      email: n.user.email,
      ids: [],
      items: [],
    };
    entry.ids.push(n.id);
    entry.items.push({
      kind: n.type,
      actorName: n.actor?.name ?? "Někdo",
      projectName: n.project.name,
      documentName: n.comment?.document?.name ?? null,
      snippet: n.comment?.body ? n.comment.body.slice(0, SNIPPET_LEN) : "",
      projectId: n.projectId,
      documentId: n.comment?.documentId ?? null,
      rootCommentId: n.comment
        ? (n.comment.parentId ?? n.comment.id)
        : null,
    });
    perUser.set(n.userId, entry);
  }

  // Odeslat každému příjemci jeden e-mail. Při selhání kompenzovat (emailedAt
  // zpět NULL) - sweep to zkusí příště, dokud notifikace nezestárne nad 24 h.
  for (const { email, ids, items } of perUser.values()) {
    const { subject, html } = buildNotificationEmail(items);
    const ok = await sendEmail({ to: email, subject, html });
    if (!ok) {
      await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { emailedAt: null },
      });
    }
  }
}
