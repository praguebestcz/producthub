// Filtr stavu komentářů — sdílený panelem i špendlíky (a testovatelný bez
// React závislostí). „open" = nevyřešené (OPEN/REOPENED), „resolved" = jen
// vyřešené, „all" = vše.

export type StatusFilter = "all" | "open" | "resolved";

export type CommentStatusLike = "OPEN" | "RESOLVED" | "REOPENED";

export function matchesStatusFilter(
  status: CommentStatusLike,
  filter: StatusFilter,
): boolean {
  if (filter === "open") return status !== "RESOLVED";
  if (filter === "resolved") return status === "RESOLVED";
  return true;
}
