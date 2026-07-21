"use client";

import { createContext, useContext } from "react";

// Kde uživatel právě píše komentář (M7 Fáze 2). threadId = odpověď v existujícím
// vláknu; dataReviewId/domPath = prvek nového komentáře (ještě bez vlákna).
export type TypingLocation = {
  pagePath: string;
  threadId: number | null;
  dataReviewId: string | null;
  domPath: string | null;
};

// Signalizace „píše / přestal" i s umístěním. Poskytuje prohlížeč dokumentu;
// konkrétní vstup (bublina / odpověď) doplní své umístění. Default = no-op.
const PresenceTypingContext = createContext<
  (typing: boolean, location: TypingLocation | null) => void
>(() => {});

export const PresenceTypingProvider = PresenceTypingContext.Provider;

export function usePresenceTyping() {
  return useContext(PresenceTypingContext);
}
