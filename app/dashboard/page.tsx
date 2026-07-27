import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  ClipboardList,
  FolderOpen,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { getSessionUser, canSeeInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recentActivity, activityVerb } from "@/lib/dashboard/activity";
import { formatRelativeCs } from "@/lib/notifications/labels";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Dlaždice souhrnu.
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

// Přehled (dashboard) — souhrn + poslední aktivita napříč projekty. Samostatná
// stránka, oddělená od seznamu projektů (/). Respektuje viditelnost interních
// a bere jen nejnovější verze dokumentů (M9 kopie nezdvojovat).
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true, isInternal: true },
  });
  const projectIds = memberships.map((m) => m.projectId);

  if (projectIds.length === 0) {
    return (
      <AppShell user={user}>
        <PageHeader
          title="Přehled"
          description="Souhrn a poslední aktivita napříč vašimi projekty."
        />
        <Card className="mt-8 border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Zatím nejste v žádném projektu — přehled se objeví, jakmile vás
            někdo pozve.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  // Nejnovější verze každého dokumentu (M9 kopie nezdvojovat).
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
  const openTotal = memberships.reduce((sum, m) => {
    const c = openCounts.get(m.projectId) ?? { pub: 0, int: 0 };
    return sum + c.pub + (canSeeInternal(m) ? c.int : 0);
  }, 0);

  const internalProjectIds = memberships
    .filter((m) => canSeeInternal(m))
    .map((m) => m.projectId);
  const isInternalSomewhere = internalProjectIds.length > 0;
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
    memberships,
    latestVersions.map((v) => v.id),
  );

  return (
    <AppShell user={user}>
      <PageHeader
        title="Přehled"
        description="Souhrn a poslední aktivita napříč vašimi projekty."
      />

      {/* Souhrn — dlaždice */}
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

      {/* Poslední aktivita */}
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
    </AppShell>
  );
}
