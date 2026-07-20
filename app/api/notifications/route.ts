import { NextResponse } from "next/server";
import { canSeeInternal, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notifications — zvoneček přihlášeného uživatele.
// Vrací posledních 20 položek + celkový počet nepřečtených (badge).
// Obrana do hloubky: notifikaci ukáže jen z projektu, kde je uživatel stále
// členem, a interní komentář jen když v něm pořád vidí interní (i když se
// notifikace zakládají už s filtrem viditelnosti — kanál nesmí uniknout).

const LIST_LIMIT = 20;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Aktuální členství uživatele (pro re-check přístupu k projektu i interního).
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true, isInternal: true },
  });
  const membershipIndex = new Map(memberships.map((m) => [m.projectId, m]));

  const raw = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      type: true,
      createdAt: true,
      readAt: true,
      projectId: true,
      actor: { select: { name: true, avatarUrl: true } },
      // Komentář jen v rozsahu nutném pro proklik a náhled (NIKDY screenshot).
      comment: {
        select: {
          id: true,
          parentId: true,
          documentId: true,
          pagePath: true,
          body: true,
          visibility: true,
        },
      },
    },
  });

  const items = raw
    .filter((n) => {
      const m = membershipIndex.get(n.projectId);
      if (!m) return false; // už není členem projektu
      if (n.comment?.visibility === "INTERNAL" && !canSeeInternal(m)) {
        return false; // interní komentář, ale už nevidí interní
      }
      return true;
    })
    .map((n) => ({
      id: n.id,
      type: n.type,
      createdAt: n.createdAt,
      read: n.readAt !== null,
      actorName: n.actor?.name ?? "Někdo",
      actorAvatarUrl: n.actor?.avatarUrl ?? null,
      projectId: n.projectId,
      documentId: n.comment?.documentId ?? null,
      // Kotva prokliku = kořen vlákna (u odpovědi je to rodič).
      rootCommentId: n.comment ? (n.comment.parentId ?? n.comment.id) : null,
      snippet: n.comment?.body ? n.comment.body.slice(0, 100) : "",
    }));

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return NextResponse.json({ items, unreadCount });
}
