"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatRelativeCs,
  notificationMessage,
  type NotificationKind,
} from "@/lib/notifications/labels";
import { cn } from "@/lib/utils";

type Item = {
  id: number;
  type: NotificationKind;
  createdAt: string;
  read: boolean;
  actorName: string;
  actorAvatarUrl: string | null;
  projectId: number;
  documentId: number | null;
  rootCommentId: number | null;
  snippet: string;
};

// Jak často se přenačte počet nepřečtených (Fáze 1). Fáze 2 (SSE) doručí živě.
const POLL_MS = 60_000;

// Zvoneček v horní liště — upozornění na odpovědi, zmínky a změny stavu vláken.
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnread(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // Tichý neúspěch — zvoneček nesmí shodit aplikaci.
    }
  }, []);

  // První načtení + pravidelný poll na počet nepřečtených. Data se stahují
  // asynchronně (setState až v then), rozjezd kaskády nehrozí.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Zavření kliknutím mimo panel nebo klávesou Esc.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) void load(); // při otevření vždy čerstvá data
      return next;
    });
  }

  async function markAllRead() {
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      // ignoruj — příště se stav dorovná pollem
    }
  }

  function openItem(item: Item) {
    setOpen(false);
    if (!item.read) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)),
      );
      void fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      }).catch(() => {});
    }
    if (item.documentId) {
      const q = item.rootCommentId ? `?comment=${item.rootCommentId}` : "";
      router.push(
        `/projects/${item.projectId}/documents/${item.documentId}${q}`,
      );
    } else {
      router.push(`/projects/${item.projectId}`);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          unread > 0 ? `Upozornění (${unread} nepřečtených)` : "Upozornění"
        }
        onClick={toggleOpen}
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pb px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border bg-background shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Upozornění</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <CheckCheck size={14} aria-hidden="true" />
                Označit vše přečtené
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                Žádná upozornění
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60",
                    !item.read && "bg-pb-soft",
                  )}
                >
                  <Avatar className="mt-0.5 size-7 shrink-0">
                    <AvatarImage src={item.actorAvatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-[11px] font-semibold text-white">
                      {item.actorName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{item.actorName}</span>{" "}
                      <span className="text-muted-foreground">
                        {notificationMessage(item.type)}
                      </span>
                    </p>
                    {item.snippet && (
                      <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                        {item.snippet}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelativeCs(item.createdAt)}
                    </p>
                  </div>
                  {!item.read && (
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-pb"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
