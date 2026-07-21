"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TypingInfo } from "@/lib/presence/roster";
import type { TypingLocation } from "@/components/presence/typing-context";

// Přítomný uživatel u dokumentu (už profiltrovaný serverem podle oprávnění).
export type PresenceUser = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  internal: boolean;
  // null = nepíše; jinak kde píše (stránka + prvek/vlákno).
  typing: TypingInfo | null;
};

// Po jak dlouhé nečinnosti se „píše" samo vypne (kdyby klient neposlal stop).
const TYPING_IDLE_MS = 4000;

// Napojení na přítomnost dokumentu přes SSE + signalizace psaní i s umístěním.
// Vrací seznam OSTATNÍCH přítomných (sebe server nevrací) a setTyping.
export function usePresence(documentId: number) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const typingRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const post = useCallback(
    (typing: boolean, location: TypingLocation | null) => {
      void fetch(`/api/documents/${documentId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing, ...(location ?? {}) }),
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

  // „Píšu tady / přestal jsem". Při true pošle umístění (jednou) a naplánuje
  // auto-stop po nečinnosti; každý stisk klávesy timer resetuje.
  const setTyping = useCallback(
    (typing: boolean, location: TypingLocation | null) => {
      if (typing && location) {
        if (!typingRef.current) {
          typingRef.current = true;
          post(true, location);
        }
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
          typingRef.current = false;
          post(false, null);
        }, TYPING_IDLE_MS);
      } else {
        if (idleTimer.current) {
          clearTimeout(idleTimer.current);
          idleTimer.current = null;
        }
        if (typingRef.current) {
          typingRef.current = false;
          post(false, null);
        }
      }
    },
    [post],
  );

  // Úklid časovače při odchodu z dokumentu.
  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return { users, setTyping };
}
