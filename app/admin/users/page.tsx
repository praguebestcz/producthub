import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
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
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PageHeader
          title="Správa uživatelů"
          description="Účet vzniká automaticky prvním přihlášením přes Google. Tady rozhodujete, kdo smí zakládat projekty. Admin se nastavuje v proměnné ADMIN_EMAILS."
        />

        <div className="mt-8">
          <Table
            head={["Uživatel", "E-mail", "Registrace", "Role", "Smí zakládat projekty"]}
          >
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </Table>
        </div>
      </main>
    </>
  );
}
