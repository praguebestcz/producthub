"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  FolderOpen,
  LogOut,
  MessagesSquare,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
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

export type SidebarUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

// Boční menu aplikace (preference Hany: navigace vlevo, sbalitelná).
// collapsible="icon" = sbalí se na úzký pruh s ikonami; stav si SidebarProvider
// pamatuje v cookie. SidebarRail = klikací hrana pro sbalení myší.
export function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();

  // Styleguide v menu záměrně není (rozhodnutí Hany) — je dostupný na /styleguide.
  const nav = [
    { title: "Projekty", href: "/", icon: FolderOpen },
    ...(user.isAdmin
      ? [{ title: "Uživatelé", href: "/admin/users", icon: Shield }]
      : []),
  ];

  return (
    <Sidebar collapsible="icon">
      {/* Logo — po sbalení zůstane jen gradientní dlaždice */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pb to-pb-orange text-white">
                <MessagesSquare className="size-4" strokeWidth={2.4} />
              </span>
              <span className="truncate text-[15px] font-semibold tracking-tight">
                ProductHub
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Aplikace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Uživatel dole — po rozkliknutí e-mail a odhlášení */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserFooterMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function UserFooterMenu({ user }: { user: SidebarUser }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
          />
        }
      >
        <Avatar className="size-8">
          <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="grid flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </span>
        <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut aria-hidden="true" />
          Odhlásit se
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
