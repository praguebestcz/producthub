import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, MessageSquare, Plus, Settings } from "lucide-react";
import { getSessionUser, requireProjectRole, canSeeInternal } from "@/lib/auth";
import { visibleCommentsWhere } from "@/lib/comments/visibility";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { plural } from "@/lib/czech";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UploadDocumentDialog } from "@/components/upload-document-dialog";

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

  const documents = await prisma.document.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { versions: true } } },
  });

  // Počet nevyřešených komentářů na dokument — odznak na kartě říká, kde čeká
  // práce. Respektuje viditelnost interních komentářů (neinterní člen je
  // nepočítá). Kořeny vláken (parentId null), napříč verzemi dokumentu.
  const openComments = await prisma.comment.findMany({
    where: {
      parentId: null,
      status: { not: "RESOLVED" },
      documentVersion: { document: { projectId } },
      ...visibleCommentsWhere(member),
    },
    select: { documentVersion: { select: { documentId: true } } },
  });
  const openByDoc = new Map<number, number>();
  for (const c of openComments) {
    const id = c.documentVersion.documentId;
    openByDoc.set(id, (openByDoc.get(id) ?? 0) + 1);
  }

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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Dokumenty</h2>
          {isAuthor && (
            <UploadDocumentDialog
              postUrl={`/api/projects/${project.id}/documents`}
              trigger={
                <Button size="sm">
                  <Plus />
                  Nahrát dokument
                </Button>
              }
            />
          )}
        </div>

        {documents.length === 0 ? (
          <Card className="mt-4 border-dashed">
            <CardContent className="flex flex-col items-center px-8 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pb-soft text-pb">
                <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">Zatím žádné dokumenty</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {isAuthor
                  ? "Naimportujte specifikaci z odkazu (Vercel apod.), nebo nahrajte HTML/ZIP."
                  : "Autor projektu zatím nenahrál žádnou specifikaci."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Link key={doc.id} href={`/projects/${project.id}/documents/${doc.id}`}>
                <Card className="h-full transition-all hover:border-pb/40 hover:shadow-md">
                  <CardContent className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pb-soft text-pb">
                      <FileText size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{doc.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {doc._count.versions}{" "}
                        {plural(doc._count.versions, "verze", "verze", "verzí")}
                      </p>
                    </div>
                    {(openByDoc.get(doc.id) ?? 0) > 0 && (
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1 border-pb/30 bg-pb-soft text-pb"
                        title="Nevyřešené komentáře"
                      >
                        <MessageSquare size={11} aria-hidden="true" />
                        {openByDoc.get(doc.id)}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
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
