"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Přítomný uživatel u dokumentu (už profiltrovaný serverem podle oprávnění).
export type PresenceUser = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  internal: boolean;
  typing: boolean;
};

// Po jak dlouhé nečinnosti se „píše" samo vypne (kdyby klient neposlal stop).
const TYPING_IDLE_MS = 4000;

// Napojení na přítomnost dokumentu přes SSE + signalizace psaní.
// Vrací seznam OSTATNÍCH přítomných (sebe server nevrací) a funkce pro „píše".
export function usePresence(documentId: number) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const typingRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postTyping = useCallback(
    (typing: boolean) => {
      void fetch(`/api/documents/${documentId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing }),
      }).catch(() => {});
    },
    [documentId],
  );

  // Připojení SSE. EventSource posílá cookie (same-origin) a sám se reconnectne.
  useEffect(() => {
    const connId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.round(performance.now() * 1000));
    const es = new EventSource(
      `/api/documents/${documentId}/presence?c=${connId}`,
    );
    es.addEventListener("presence", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        setUsers(Array.isArray(d.users) ? d.users : []);
      } catch {
        // ignoruj vadnou zprávu
      }
    });
    return () => {
      es.close();
    };
  }, [documentId]);

  // „Právě píšu" - pošle true (jednou) a naplánuje auto-stop po nečinnosti.
  const signalTyping = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      postTyping(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      typingRef.current = false;
      postTyping(false);
    }, TYPING_IDLE_MS);
  }, [postTyping]);

  const stopTyping = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (typingRef.current) {
      typingRef.current = false;
      postTyping(false);
    }
  }, [postTyping]);

  // Úklid při odchodu z dokumentu.
  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return { users, signalTyping, stopTyping };
}
