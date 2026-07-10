import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientsTable, NewClientDialog } from "./clients-client";

// Klienti (složky projektů) — jen pro uživatele s canCreateProjects (tým PB).
export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.canCreateProjects) redirect("/");

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });

  return (
    <AppShell user={user}>
      <PageHeader
        title="Klienti"
        description="Složky, které seskupují projekty — DDS, Foto Škoda, … i PragueBest. Klient nenese žádná přístupová práva, je to jen organizace."
        actions={<NewClientDialog />}
      />
      <div className="mt-8">
        <ClientsTable
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            projects: c._count.projects,
            createdAt: c.createdAt,
          }))}
        />
      </div>
    </AppShell>
  );
}
