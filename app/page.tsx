import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  Building2,
  ClipboardList,
  FolderOpen,
  MailOpen,
  MessageSquare,
  Users,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { getSessionUser, canSeeInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { plural } from "@/lib/czech";
import { recentActivity, activityVerb } from "@/lib/dashboard/activity";
import { formatRelativeCs } from "@/lib/notifications/labels";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { cn } from "@/lib/utils";

type ProjectCard = {
  id: number;
  name: string;
  description: string | null;
  role: "AUTHOR" | "COMMENTER" | "READER";
  documents: number;
  members: number;
  open: number;
};

// Dlaždice souhrnu v horním pruhu dashboardu.
function SummaryTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            accent ? "bg-pb-soft text-pb" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div
            className={cn(
              "text-2xl font-bold leading-none",
              accent && "text-pb",
            )}
          >
            {value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Dashboard — souhrn + poslední aktivita + projekty uživatele (dle klienta).
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

  // --- Dashboard: souhrn + poslední aktivita (nad seznamem projektů) ---
  const latestVersionIds = latestVersions.map((v) => v.id);
  const openTotal = memberships.reduce((sum, m) => {
    const c = openCounts.get(m.projectId) ?? { pub: 0, int: 0 };
    return sum + c.pub + (canSeeInternal(m) ? c.int : 0);
  }, 0);
  const internalProjectIds = memberships
    .filter((m) => canSeeInternal(m))
    .map((m) => m.projectId);
  const isInternalSomewhere = internalProjectIds.length > 0;
  // Čekající zadání — jen z projektů, kde jsem interní (klient koncept nevidí).
  const pendingTasks = isInternalSomewhere
    ? await prisma.promptExport.count({
        where: {
          status: { not: "DONE" },
          document: { projectId: { in: internalProjectIds } },
        },
      })
    : 0;
  const unreadNotifications = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  const activity = await recentActivity(
    user.id,
    memberships.map((m) => ({
      projectId: m.projectId,
      role: m.role,
      isInternal: m.isInternal,
    })),
    latestVersionIds,
  );

  // Seskupení podle klienta: klienti abecedně, „Nezařazené" nakonec.
  const groups = new Map<string, ProjectCard[]>();
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
        <>
          {/* Souhrn — dlaždice napříč projekty */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              icon={MessageSquare}
              label="Otevřené komentáře"
              value={openTotal}
              accent
            />
            {isInternalSomewhere && (
              <SummaryTile
                icon={ClipboardList}
                label="Čekající zadání"
                value={pendingTasks}
              />
            )}
            <SummaryTile
              icon={Bell}
              label="Pro mě"
              value={unreadNotifications}
              accent
            />
            <SummaryTile
              icon={FolderOpen}
              label="Projekty"
              value={memberships.length}
            />
          </div>

          {/* Poslední aktivita napříč projekty */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Poslední aktivita
            </h2>
            {activity.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Zatím žádná aktivita.
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y">
                  {activity.map((a) => (
                    <li key={a.key}>
                      <Link
                        href={`/projects/${a.projectId}/documents/${a.documentId}?comment=${a.rootCommentId}`}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <Avatar className="mt-0.5 size-8 shrink-0">
                          <AvatarImage src={a.actorAvatarUrl ?? undefined} alt="" />
                          <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white">
                            {a.actorName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug">
                            <span className="font-medium">{a.actorName}</span>{" "}
                            <span className="text-muted-foreground">
                              {activityVerb(a.kind)}
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.projectName} › {a.documentName} ·{" "}
                            {formatRelativeCs(a.at.toISOString())}
                          </p>
                          {a.snippet && (
                            <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                              {a.snippet}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          {/* Projekty */}
          <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Projekty
          </h2>
          <div className="grid gap-10">
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
                          {p.open > 0 && (
                            <span
                              className="flex items-center gap-1 font-medium text-pb"
                              title="Nevyřešené komentáře"
                            >
                              <MessageSquare size={13} aria-hidden="true" />
                              {p.open}{" "}
                              {plural(
                                p.open,
                                "nevyřešený",
                                "nevyřešené",
                                "nevyřešených",
                              )}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
