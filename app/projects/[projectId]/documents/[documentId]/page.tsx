import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  canSeeInternal,
  getSessionUser,
  requireProjectRole,
  roleAtLeast,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { DocumentViewer } from "./viewer";

// Prohlížeč dokumentu — iframe s uloženou specifikací + přepínač verzí.
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { projectId: pid, documentId: did } = await params;
  const projectId = Number(pid);
  const documentId = Number(did);

  const member = await requireProjectRole(user.id, projectId, "READER");
  if (!member) notFound();

  const document = await prisma.document.findFirst({
    where: { id: documentId, projectId },
    include: {
      project: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          entryPath: true,
          source: true,
          sourceUrl: true,
          createdAt: true,
        },
      },
    },
  });
  if (!document) notFound();

  // Členové pro @našeptávač zmínek (M6) — deaktivovaní se nenabízejí (M4.5).
  // Seznam jde jako prop (stránka je za requireProjectRole), žádný endpoint.
  const members = await prisma.projectMember.findMany({
    where: { projectId, user: { deactivatedAt: null } },
    select: {
      userId: true,
      user: { select: { name: true, avatarUrl: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <AppShell user={user} fullWidth>
      <nav className="flex gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Projekty
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-foreground"
        >
          {document.project.name}
        </Link>
      </nav>

      <DocumentViewer
        documentId={document.id}
        projectId={projectId}
        name={document.name}
        versions={document.versions.map((v) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
        }))}
        isAuthor={member.role === "AUTHOR"}
        canComment={roleAtLeast(member.role, "COMMENTER")}
        canSeeInternal={canSeeInternal(member)}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
        }))}
      />
    </AppShell>
  );
}
