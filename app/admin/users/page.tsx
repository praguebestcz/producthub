import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
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
      canCreateProjects: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Správa uživatelů
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          Účet vzniká automaticky prvním přihlášením přes Google. Tady
          rozhodujete, kdo smí zakládat projekty. Admin se nastavuje
          v proměnné ADMIN_EMAILS, ne tady.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-line bg-bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-3">Jméno</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Registrace</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Smí zakládat projekty</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
