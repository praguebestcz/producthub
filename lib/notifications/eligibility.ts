import type { ProjectRole } from "@prisma/client";
import { canSeeInternal } from "@/lib/auth";

// Sdílený re-check: SMÍ příjemce dostat tuto notifikaci? Používá ho výpis
// zvonečku (GET /api/notifications) i odesílač e-mailů, aby se logika nemohla
// rozejít - notifikace (a e-mail obzvlášť, nese úryvek textu) je kanál úniku
// interních komentářů. Vyhodnocuje se z AKTUÁLNÍHO stavu členství a viditelnosti
// (u e-mailů s prodlevou 5+ min od vzniku se stav mohl změnit).

export type NotifMember = { role: ProjectRole; isInternal: boolean } | undefined;

export function isNotificationDeliverable(opts: {
  // Aktuální členství příjemce v projektu notifikace (undefined = už není členem).
  member: NotifMember;
  // Viditelnost komentáře, ke kterému notifikace patří (null = notifikace bez
  // komentáře, např. požadavek/pozvánka - žádné interní omezení).
  commentVisibility: "PUBLIC" | "INTERNAL" | null;
  // Komentář mezitím zmizel (obrana do hloubky; u zvonečku se to díky kaskádě
  // neděje, u e-mailu s prodlevou je to pojistka).
  commentMissing: boolean;
}): boolean {
  const { member, commentVisibility, commentMissing } = opts;
  if (!member) return false; // už není členem projektu
  if (commentMissing) return false; // komentář zmizel
  if (commentVisibility === "INTERNAL" && !canSeeInternal(member)) return false;
  return true;
}
