// Texty a formátování pro zvoneček — čisté funkce bez serverových závislostí
// (bezpečné pro import v klientské komponentě i v testech).

// Zrcadlí enum NotificationType z Prisma schématu (nechceme sem tahat @prisma
// jen kvůli typu do klienta).
export type NotificationKind =
  | "NEW_COMMENT"
  | "NEW_REPLY"
  | "MENTION"
  | "COMMENT_STATUS_CHANGED"
  | "REQUIREMENT_APPROVED"
  | "REQUIREMENT_CLOSED"
  | "PROJECT_INVITED";

// Věta za jménem aktéra („{jméno} {zpráva}"). Rod neznáme → tvar „přidal(a)".
export function notificationMessage(kind: NotificationKind): string {
  switch (kind) {
    case "NEW_COMMENT":
      return "přidal(a) nový komentář";
    case "NEW_REPLY":
      return "odpověděl(a) ve vláknu";
    case "MENTION":
      return "vás zmínil(a) v komentáři";
    case "COMMENT_STATUS_CHANGED":
      return "změnil(a) stav vlákna";
    case "REQUIREMENT_APPROVED":
      return "schválil(a) požadavek";
    case "REQUIREMENT_CLOSED":
      return "uzavřel(a) požadavek";
    case "PROJECT_INVITED":
      return "vás přidal(a) do projektu";
    default:
      return "provedl(a) akci";
  }
}

// Relativní čas v češtině: „právě teď", „před 5 min", „před 2 h", „před 3 dny",
// starší než týden → datum. `now` je parametr kvůli testovatelnosti.
export function formatRelativeCs(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "právě teď";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `před ${min} min`;
  const hod = Math.floor(min / 60);
  if (hod < 24) return `před ${hod} h`;
  const dny = Math.floor(hod / 24);
  if (dny < 7) return `před ${dny} ${dny === 1 ? "dnem" : "dny"}`;
  return new Date(iso).toLocaleDateString("cs-CZ");
}
