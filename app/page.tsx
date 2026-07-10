import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, MailOpen, Users, FileText } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { plural } from "@/lib/czech";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/new-project-dialog";

// Dashboard — seznam projektů, kde je uživatel členem.
export default async function Home() {
  const user = await getSessionUser();
  // Proxy nepřihlášené přesměruje už dřív; tohle je pojistka (obrana do hloubky).
  if (!user) redirect("/login");

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: { _count: { select: { members: true, documents: true } } },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  return (
    <AppShell user={user}>
      <PageHeader
        title="Projekty"
        description="Specifikace, prototypy a wireframy k připomínkování."
        actions={user.canCreateProjects ? <NewProjectDialog /> : undefined}
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
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => (
            <Link key={m.project.id} href={`/projects/${m.project.id}`}>
              <Card className="h-full transition-all hover:border-pb/40 hover:shadow-md">
                <CardContent className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold leading-snug">
                      {m.project.name}
                    </h2>
                    <Badge
                      variant={m.role === "AUTHOR" ? "default" : "secondary"}
                    >
                      {ROLE_LABELS[m.role]}
                    </Badge>
                  </div>
                  {m.project.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {m.project.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText size={13} aria-hidden="true" />
                      {m.project._count.documents}{" "}
                      {plural(m.project._count.documents, "dokument", "dokumenty", "dokumentů")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} aria-hidden="true" />
                      {m.project._count.members}{" "}
                      {plural(m.project._count.members, "člen", "členové", "členů")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
