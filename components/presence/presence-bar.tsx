"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userColor } from "@/lib/presence/colors";
import { cn } from "@/lib/utils";
import type { PresenceUser } from "./use-presence";

// Text „kdo píše" - 1 jméno, 2 jména, jinak počet.
function typingLabel(names: string[]): string {
  const first = (n: string) => n.split(" ")[0] || n;
  if (names.length === 1) return `${first(names[0])} píše…`;
  if (names.length === 2)
    return `${first(names[0])} a ${first(names[1])} píší…`;
  return `${names.length} lidí píše…`;
}

// Lišta přítomných u dokumentu (M7 Fáze 2). Zobrazuje OSTATNÍ přítomné (server
// už profiltroval podle oprávnění - externí tu nikdy neuvidí interní). Prázdné,
// když je uživatel na dokumentu sám.
export function PresenceBar({
  users,
  onJump,
}: {
  users: PresenceUser[];
  // Klik na avatar píšícího → skok na prvek, kde píše. Nepovinné.
  onJump?: (user: PresenceUser) => void;
}) {
  if (users.length === 0) return null;
  const shown = users.slice(0, 5);
  const extra = users.length - shown.length;
  const typing = users.filter((u) => u.typing);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {shown.map((u) => {
          const clickable = !!u.typing && !!onJump;
          const color = userColor(u.userId);
          // Barevný kroužek = identita uživatele (stejná barva jako u prvku).
          const ring = { boxShadow: `0 0 0 2px ${color}` };
          const avatar = (
            <>
              <Avatar className="size-7">
                <AvatarImage src={u.avatarUrl ?? undefined} alt="" />
                <AvatarFallback
                  className="text-[11px] font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {u.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {u.typing && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-emerald-500 ring-2 ring-background"
                  aria-hidden="true"
                />
              )}
            </>
          );
          return clickable ? (
            <button
              key={u.userId}
              type="button"
              onClick={() => onJump?.(u)}
              title={`${u.name} píše — přejít na místo`}
              style={ring}
              className="relative inline-flex rounded-full transition-transform hover:z-10 hover:scale-110"
            >
              {avatar}
            </button>
          ) : (
            <span
              key={u.userId}
              style={ring}
              className="relative inline-flex rounded-full"
              title={u.name}
            >
              {avatar}
            </span>
          );
        })}
        {extra > 0 && (
          <span
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground ring-2 ring-background",
            )}
          >
            +{extra}
          </span>
        )}
      </div>
      {typing.length > 0 && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {typingLabel(typing.map((u) => u.name))}
        </span>
      )}
    </div>
  );
}
