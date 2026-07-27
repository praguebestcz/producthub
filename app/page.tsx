import { redirect } from "next/navigation";
import { FolderOpen, MailOpen } from "lucide-react";
import { getSessionUser, canSeeInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { NewProjectDialog } from "@/components/new-project-dialog";
import {
  ClientGroups,
  type ClientGroup,
  type ProjectCardData,
} from "@/components/projects/client-groups";

// Seznam projektů uživatele, seskupený podle klienta. Přehled (souhrn +
// poslední aktivita) je samostatná stránka /dashboard.
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

  // Nevyřešené komentáře na projekt — odznak na kartě ukáže, kde čeká práce.
  // Jeden dotaz přes všechny projekty uživatele; viditelnost interních se
  // vyhodnotí per členství (každý má v projektu jinou roli/interní příznak).
  const projectIds = memberships.map((m) => m.projectId);
  // Jen NEJNOVĚJŠÍ verze každého dokumentu — M9 kopíruje nevyřešené komentáře do
  // nové verze, počítání napříč verzemi by je zdvojilo (starší = read-only historie).
  const latestVersions = await prisma.documentVersion.findMany({
    where: { document: { projectId: { in: projectIds } } },
    orderBy: [{ documentId: "asc" }, { versionNumber: "desc" }],
    distinct: ["documentId"],
    select: { id: true, document: { select: { projectId: true } } },
  });
  const latestIdToProject = new Map(
    latestVersions.map((v) => [v.id, v.document.projectId]),
  );
  const openComments = await prisma.comment.findMany({
    where: {
      parentId: null,
      status: { not: "RESOLVED" },
      documentVersionId: { in: latestVersions.map((v) => v.id) },
    },
    select: { visibility: true, documentVersionId: true },
  });
  const openCounts = new Map<number, { pub: number; int: number }>();
  for (const c of openComments) {
    const pid = latestIdToProject.get(c.documentVersionId);
    if (pid === undefined) continue;
    const e = openCounts.get(pid) ?? { pub: 0, int: 0 };
    if (c.visibility === "INTERNAL") e.int += 1;
    else e.pub += 1;
    openCounts.set(pid, e);
  }

  // Seskupení podle klienta: klienti abecedně, „Nezařazené" nakonec.
  const groups = new Map<string, ProjectCardData[]>();
  for (const m of memberships) {
    const key = m.project.client?.name ?? "";
    if (!groups.has(key)) groups.set(key, []);
    const counts = openCounts.get(m.project.id) ?? { pub: 0, int: 0 };
    groups.get(key)!.push({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      role: m.role,
      documents: m.project._count.documents,
      members: m.project._count.members,
      open: counts.pub + (canSeeInternal(m) ? counts.int : 0),
    });
  }
  const clientGroups: ClientGroup[] = [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "") return 1; // Nezařazené nakonec
      if (b === "") return -1;
      return a.localeCompare(b, "cs");
    })
    .map(([name, projects]) => ({ key: name || "__none", name, projects }));

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
        <ClientGroups groups={clientGroups} />
      )}
    </AppShell>
  );
}
