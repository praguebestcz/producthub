import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
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
      createdAt: true,
    },
  });

  return (
    <AppShell user={user}>
      <PageHeader
        title="Správa uživatelů"
        description="Účet vzniká automaticky prvním přihlášením přes Google. Tady rozhodujete, kdo smí zakládat projekty. Admin se nastavuje v proměnné ADMIN_EMAILS."
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
