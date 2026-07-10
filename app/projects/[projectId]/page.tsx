import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, Settings } from "lucide-react";
import { getSessionUser, requireProjectRole, canSeeInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Přehled projektu — dokumenty (obsah přijde v M5) a členové.
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const projectId = Number((await params).projectId);
  if (!Number.isInteger(projectId) || projectId <= 0) notFound();

  const member = await requireProjectRole(user.id, projectId, "READER");
  if (!member) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { name: true } },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { documents: true } },
    },
  });
  if (!project) notFound();

  const isAuthor = member.role === "AUTHOR";

  return (
    <AppShell user={user}>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        breadcrumbs={
          <nav className="flex gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Projekty
            </Link>
            {project.client && (
              <>
                <span>/</span>
                <span>{project.client.name}</span>
              </>
            )}
          </nav>
        }
        actions={
          isAuthor ? (
            <Link
              href={`/projects/${project.id}/settings`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Settings />
              Nastavení
            </Link>
          ) : undefined
        }
      />

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Dokumenty</h2>
        <Card className="mt-4 border-dashed">
          <CardContent className="flex flex-col items-center px-8 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pb-soft text-pb">
              <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-semibold">Zatím žádné dokumenty</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Nahrávání specifikací (HTML, ZIP, import z URL) přijde
              v milníku M5.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">
          Členové ({project.members.length})
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {project.members.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={m.user.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white">
                    {m.user.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.user.email}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={m.role === "AUTHOR" ? "default" : "secondary"}
                  >
                    {ROLE_LABELS[m.role]}
                  </Badge>
                  {canSeeInternal(m) && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      interní
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
