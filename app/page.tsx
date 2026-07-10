import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, FolderOpen, MailOpen, Users, FileText } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { plural } from "@/lib/czech";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/new-project-dialog";

type ProjectCard = {
  id: number;
  name: string;
  description: string | null;
  role: "AUTHOR" | "COMMENTER" | "READER";
  documents: number;
  members: number;
};

// Dashboard — projekty uživatele seskupené podle klienta (přání Hany).
export default async function Home() {
  const user = await getSessionUser();
  // Proxy nepřihlášené přesměruje už dřív; tohle je pojistka (obrana do hloubky).
  if (!user) redirect("/login");

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { members: true, documents: true } },
        },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  // Seskupení podle klienta: klienti abecedně, „Nezařazené" nakonec.
  const groups = new Map<string, ProjectCard[]>();
  for (const m of memberships) {
    const key = m.project.client?.name ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      role: m.role,
      documents: m.project._count.documents,
      members: m.project._count.members,
    });
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    if (a === "") return 1; // Nezařazené nakonec
    if (b === "") return -1;
    return a.localeCompare(b, "cs");
  });

  // Klienti pro výběr v dialogu Nový projekt (jen tým s canCreateProjects).
  const clients = user.canCreateProjects
    ? await prisma.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <AppShell user={user}>
      <PageHeader
        title="Projekty"
        description="Specifikace, prototypy a wireframy k připomínkování."
        actions={
          user.canCreateProjects ? (
            <NewProjectDialog clients={clients} />
          ) : undefined
        }
      />

      {memberships.length === 0 ? (
        // Prázdný stav — ikona v měkkém kruhu, vysvětlení dalšího kroku
        <Card className="mt-10 border-dashed">
          <CardContent className="flex flex-col items-center px-8 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pb-soft text-pb">
              {user.canCreateProjects ? (
                <FolderOpen size={26} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <MailOpen size={26} strokeWidth={1.8} aria-hidden="true" />
              )}
            </span>
            {user.canCreateProjects ? (
              <>
                <h2 className="mt-5 text-lg font-semibold">
                  Zatím žádné projekty
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Založte první projekt tlačítkem „Nový projekt&ldquo; — pak
                  do něj nahrajete specifikaci a pozvete recenzenty.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-5 text-lg font-semibold">
                  Čekáte na pozvánku
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Zatím nevidíte žádné projekty. Jakmile vás autor projektu
                  pozve, projekt se objeví tady.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-10">
          {sortedGroups.map(([clientName, projects]) => (
            <section key={clientName || "__none"}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 size={15} aria-hidden="true" />
                {clientName || "Nezařazené"}
                <span className="font-normal">({projects.length})</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`}>
                    <Card className="h-full transition-all hover:border-pb/40 hover:shadow-md">
                      <CardContent className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold leading-snug">
                            {p.name}
                          </h3>
                          <Badge
                            variant={p.role === "AUTHOR" ? "default" : "secondary"}
                          >
                            {ROLE_LABELS[p.role]}
                          </Badge>
                        </div>
                        {p.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {p.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText size={13} aria-hidden="true" />
                            {p.documents}{" "}
                            {plural(p.documents, "dokument", "dokumenty", "dokumentů")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={13} aria-hidden="true" />
                            {p.members}{" "}
                            {plural(p.members, "člen", "členové", "členů")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
