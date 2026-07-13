import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAdminEmails } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserRow } from "./user-row";

// Správa uživatelů — jen pro adminy. Ostatní přesměrujeme na dashboard.
export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      canCreateProjects: true,
      isAdmin: true,
      deactivatedAt: true,
      createdAt: true,
      // Počty pro rozhodnutí, zda jde účet smazat (musí být všechny 0).
      _count: {
        select: {
          memberships: true,
          createdProjects: true,
          createdClients: true,
          sentInvitations: true,
          uploadedVersions: true,
          comments: true,
          createdRequirements: true,
          approvedRequirements: true,
          resolvedComments: true,
        },
      },
    },
  });

  const adminEmails = getAdminEmails();
  // Smazat lze účet bez obsahu, který není já ani (živý) admin.
  const rows = users.map((u) => {
    const contentCount = Object.values(u._count).reduce((a, b) => a + b, 0);
    return {
      ...u,
      canDelete:
        contentCount === 0 &&
        u.id !== user.id &&
        !adminEmails.includes(u.email.toLowerCase()),
    };
  });

  return (
    <AppShell user={user}>
      <PageHeader
        title="Správa uživatelů"
        description="Tři úrovně: Uživatel (jen pozvané projekty) → Tým (smí zakládat projekty a klienty) → Admin (spravuje uživatele). Přepínačem měníte Uživatel ↔ Tým; Admin se nastavuje jen v proměnné ADMIN_EMAILS."
      />

      <div className="mt-8 rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Uživatel</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Registrace</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Smí zakládat projekty</TableHead>
              <TableHead className="w-24" aria-label="Akce" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                myId={user.id}
                canDelete={u.canDelete}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
