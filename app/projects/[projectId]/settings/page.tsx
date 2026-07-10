import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, requireProjectRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectForm } from "./project-form";
import { InviteForm } from "./invite-form";
import { MembersTable } from "./members-table";
import { DangerZone } from "./danger-zone";

// Nastavení projektu — jen AUTHOR (ostatním se tváří jako neexistující).
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const projectId = Number((await params).projectId);
  if (!Number.isInteger(projectId) || projectId <= 0) notFound();

  const member = await requireProjectRole(user.id, projectId, "AUTHOR");
  if (!member) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      invitations: {
        where: { acceptedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          role: true,
          isInternal: true,
          createdAt: true,
        },
      },
    },
  });
  if (!project) notFound();

  return (
    <AppShell user={user}>
      <PageHeader
        title="Nastavení projektu"
        description={project.name}
        breadcrumbs={
          <nav className="flex gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Projekty
            </Link>
            <span>/</span>
            <Link
              href={`/projects/${project.id}`}
              className="hover:text-foreground"
            >
              {project.name}
            </Link>
          </nav>
        }
      />

      <div className="mt-8 grid max-w-3xl gap-10">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Základní údaje
          </h2>
          <ProjectForm
            project={{
              id: project.id,
              name: project.name,
              description: project.description,
              constraints: project.constraints,
            }}
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Pozvat do projektu
          </h2>
          <InviteForm projectId={project.id} />
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Členové a pozvánky
          </h2>
          <MembersTable
            projectId={project.id}
            myMemberId={member.id}
            members={project.members.map((m) => ({
              id: m.id,
              role: m.role,
              isInternal: m.isInternal,
              user: m.user,
            }))}
            invitations={project.invitations}
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-destructive">
            Nebezpečná zóna
          </h2>
          <DangerZone projectId={project.id} projectName={project.name} />
        </section>
      </div>
    </AppShell>
  );
}
