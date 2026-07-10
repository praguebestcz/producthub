import type { ProjectRole } from "@prisma/client";

// České popisky rolí — jediné místo (UI je používá napříč aplikací).
export const ROLE_LABELS: Record<ProjectRole, string> = {
  AUTHOR: "Autor",
  COMMENTER: "Komentátor",
  READER: "Čtenář",
};

// Krátké vysvětlení pro formuláře.
export const ROLE_HINTS: Record<ProjectRole, string> = {
  AUTHOR: "Spravuje projekt, schvaluje požadavky",
  COMMENTER: "Komentuje a diskutuje",
  READER: "Jen prohlíží",
};
