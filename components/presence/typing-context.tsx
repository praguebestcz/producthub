"use client";

import { createContext, useContext } from "react";

// Kanál pro signalizaci „píše / přestal" z libovolného vstupu komentáře nahoru
// do prohlížeče (M7 Fáze 2), bez protahování props přes panel a bublinu.
// Default = no-op (mimo prohlížeč dokumentu se nic neděje).
const TypingSignalContext = createContext<(typing: boolean) => void>(() => {});

export const TypingSignalProvider = TypingSignalContext.Provider;

export function useTypingSignal() {
  return useContext(TypingSignalContext);
}
