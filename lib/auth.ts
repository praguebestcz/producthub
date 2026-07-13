import { cookies } from "next/headers";
import type { ProjectMember, ProjectRole, User } from "@prisma/client";
import { prisma } from "./prisma";
import { verifySessionToken } from "./jwt";
import { getAdminEmails } from "./env";
import type { GoogleProfile } from "./google-oauth";

// Autentizace a autorizace — jediné místo, přes které jde zjišťování
// přihlášeného uživatele a členství v projektu. KAŽDÝ projektový endpoint
// musí projít přes requireProjectRole (položka security review).

export const SESSION_COOKIE = "session";

// Pořadí rolí pro porovnávání „aspoň": AUTHOR > COMMENTER > READER.
const ROLE_ORDER: Record<ProjectRole, number> = {
  AUTHOR: 3,
  COMMENTER: 2,
  READER: 1,
};

// Čistá funkce (testovatelná bez DB): má role aspoň požadovanou úroveň?
export function roleAtLeast(role: ProjectRole, min: ProjectRole): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[min];
}

// Interní člen vidí INTERNAL komentáře. AUTHOR je interní vždy (vynucení v kódu,
// jak předepisuje schéma — viz komentář u ProjectMember.isInternal).
export function canSeeInternal(member: Pick<ProjectMember, "role" | "isInternal">): boolean {
  return member.isInternal || member.role === "AUTHOR";
}

// Členství uživatele v projektu s minimální rolí, jinak null.
// Volající vrací 404 (ne 403) — neprozrazovat existenci projektu nečlenům.
export async function requireProjectRole(
  userId: number,
  projectId: number,
  min: ProjectRole,
): Promise<ProjectMember | null> {
  if (!Number.isInteger(projectId) || projectId <= 0) return null;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member || !roleAtLeast(member.role, min)) return null;
  return member;
}

// Přihlášený uživatel z session cookie, nebo null.
// Kontroluje podpis, typ tokenu i `iat >= tokenValidFrom` (zneplatnění relací).
export async function getSessionUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return null;
  // Deaktivovaný účet = mrtvá session, ať je lístek jakkoli čerstvý (M4.5).
  if (user.deactivatedAt) return null;
  // Lístek vydaný před razítkem tokenValidFrom = neplatný (odhlášení všech relací).
  if (payload.iat < Math.floor(user.tokenValidFrom.getTime() / 1000)) {
    return null;
  }
  return user;
}

// Chyba, kterou callback umí přeložit na čitelnou hlášku (ne 500).
export class EmailConflictError extends Error {
  constructor() {
    super("E-mail už patří jinému účtu");
  }
}

// Deaktivovaný účet se pokusil přihlásit (M4.5) — callback ukáže čitelnou hlášku.
export class AccountDeactivatedError extends Error {
  constructor() {
    super("Účet je deaktivovaný");
  }
}

// Založí/aktualizuje uživatele podle Google profilu a převezme čekající pozvánky.
// Vrací uživatele. Po expert review:
//  - párování primárně přes googleId (sub) — e-mail se na Googlu může změnit
//  - kolize e-mailu s jiným účtem → EmailConflictError (čitelná chyba, ne 500)
//  - admin bootstrap podle ADMIN_EMAILS (idempotentní, při každém přihlášení)
export async function ensureUserFromGoogle(
  profile: GoogleProfile,
): Promise<User> {
  const isBootstrapAdmin = getAdminEmails().includes(profile.email);

  return prisma.$transaction(
    async (tx) => {
      const byGoogleId = await tx.user.findUnique({
        where: { googleId: profile.googleId },
      });

      // Po expert review (M4.5): deaktivovaný účet se kontroluje JAKO PRVNÍ —
      // nesmí se aktualizovat (jméno/avatar) ani převzít pozvánky.
      if (byGoogleId?.deactivatedAt) {
        throw new AccountDeactivatedError();
      }

      // E-mail nesmí patřit jinému účtu (jiné googleId) — unikátní sloupec.
      const byEmail = await tx.user.findUnique({
        where: { email: profile.email },
      });
      if (byEmail && byEmail.googleId !== profile.googleId) {
        throw new EmailConflictError();
      }

      // Po expert review (M4.5): isAdmin se synchronizuje s ADMIN_EMAILS
      // OBĚMA směry (vyřazený e-mail = admin práva zmizí při dalším přihlášení).
      // canCreateProjects se bootstrapem jen PŘIDÁVÁ — právo udělené adminem
      // v UI se přihlášením nesmí odebrat.
      const user = byGoogleId
        ? await tx.user.update({
            where: { id: byGoogleId.id },
            data: {
              email: profile.email,
              name: profile.name,
              avatarUrl: profile.avatarUrl,
              isAdmin: isBootstrapAdmin,
              ...(isBootstrapAdmin ? { canCreateProjects: true } : {}),
            },
          })
        : await tx.user.create({
            data: {
              googleId: profile.googleId,
              email: profile.email,
              name: profile.name,
              avatarUrl: profile.avatarUrl,
              isAdmin: isBootstrapAdmin,
              canCreateProjects: isBootstrapAdmin,
            },
          });

      // Převzetí čekajících pozvánek (párování přes lowercase e-mail).
      const pending = await tx.invitation.findMany({
        where: { email: user.email, acceptedAt: null },
      });
      if (pending.length > 0) {
        await tx.projectMember.createMany({
          data: pending.map((inv) => ({
            projectId: inv.projectId,
            userId: user.id,
            role: inv.role,
            isInternal: inv.isInternal,
          })),
          skipDuplicates: true,
        });
        await tx.invitation.updateMany({
          where: { id: { in: pending.map((inv) => inv.id) } },
          data: { acceptedAt: new Date() },
        });
      }

      return user;
    },
    // Po ladění 2026-07-10: studený start Prisma enginu na Windows trvá ~2 s
    // a výchozí maxWait (2 s) přihlášení náhodně shazoval („Unable to start
    // a transaction in the given time"). Přihlášení nesmí být závislé na
    // zahřátém enginu — dev i Railway po probuzení.
    { maxWait: 10_000, timeout: 15_000 },
  );
}
