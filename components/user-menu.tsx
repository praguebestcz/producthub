"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Menu přihlášeného uživatele v hlavičce — avatar + jméno, po rozkliknutí
// e-mail, odkaz na správu uživatelů (admin) a odhlášení.
export function UserMenu({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
}) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <Avatar className="h-[26px] w-[26px]">
          <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-[160px] truncate text-sm font-medium">
          {user.name}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        {/* Base UI: GroupLabel smí existovat jen uvnitř Group — jinak celé menu spadne */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user.isAdmin && (
          <DropdownMenuItem
            render={<Link href="/admin/users" />}
          >
            <Shield aria-hidden="true" />
            Správa uživatelů
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut aria-hidden="true" />
          Odhlásit se
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
