import type { CommentVisibility, ProjectMember } from "@prisma/client";
import { canSeeInternal } from "@/lib/auth";

// Viditelnost interních komentářů — SDÍLENÝ filtr pro všechny kanály.
// Security review (M6): interní komentáře mají 4 kanály úniku — REST (M6),
// SSE (M7), notifikace (M7), požadavky + generovaný prompt (M8). Každý kanál
// MUSÍ filtrovat přes tyto funkce, žádný vlastní ad-hoc filtr.

type MemberVisibility = Pick<ProjectMember, "role" | "isInternal">;

// Prisma where-fragment: neinterní člen vidí jen PUBLIC.
// Používat na kořenech I na replies (interní odpověď pod veřejným vláknem).
export function visibleCommentsWhere(
  member: MemberVisibility,
): { visibility?: "PUBLIC" } {
  return canSeeInternal(member) ? {} : { visibility: "PUBLIC" };
}

// Predikát pro jeden komentář — akce nad cizím INTERNAL vláknem vrací 404
// (existence se neprozrazuje, stejný princip jako requireProjectRole).
export function canViewComment(
  member: MemberVisibility,
  comment: { visibility: CommentVisibility },
): boolean {
  return comment.visibility === "PUBLIC" || canSeeInternal(member);
}

// Viditelnost odpovědi: INTERNAL rodič VYNUCUJE interní odpověď (veřejná
// odpověď by unikla neinterním členům). Pod veřejným vláknem platí požadavek
// (interní poznámka pod veřejnou diskusí je dovolená).
export function resolveReplyVisibility(
  parentVisibility: CommentVisibility,
  requested: CommentVisibility,
): CommentVisibility {
  return parentVisibility === "INTERNAL" ? "INTERNAL" : requested;
}
