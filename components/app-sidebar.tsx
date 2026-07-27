"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LAST_SEEN_KEY,
  LATEST_RELEASE_ID,
  NEWS_SEEN_EVENT,
} from "@/lib/releases";
import {
  Bot,
  Building2,
  ChevronsUpDown,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessagesSquare,
  PanelLeftClose,
  Settings,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
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
  canCreateProjects: boolean;
};

// Boční menu aplikace (preference Hany: navigace vlevo, sbalitelná).
// collapsible="icon" = sbalí se na úzký pruh s ikonami; stav si SidebarProvider
// pamatuje v cookie. SidebarRail = klikací hrana pro sbalení myší.
export function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  // Odznak „novinky" u Nápovědy: jsou nové novinky, které uživatel ještě neviděl?
  // Čte se z localStorage (bez DB), po mountu (jinak hydration mismatch). Aktualizuje
  // se po „Rozumím" / otevření Nápovědy (událost) i při změně v jiné záložce (storage).
  const [hasNews, setHasNews] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const seen = Number(window.localStorage.getItem(LAST_SEEN_KEY)) || 0;
        setHasNews(seen < LATEST_RELEASE_ID);
      } catch {
        setHasNews(false);
      }
    };
    read();
    window.addEventListener(NEWS_SEEN_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(NEWS_SEEN_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  // Styleguide v menu záměrně není (rozhodnutí Hany) — je dostupný na /styleguide.
  // Klienti jen pro tým s právem zakládat projekty (názvy klientů = obchodní info).
  const nav = [
    { title: "Přehled", href: "/dashboard", icon: LayoutDashboard },
    { title: "Projekty", href: "/", icon: FolderOpen },
    ...(user.canCreateProjects
      ? [{ title: "Klienti", href: "/clients", icon: Building2 }]
      : []),
    ...(user.isAdmin
      ? [
          { title: "Uživatelé", href: "/admin/users", icon: Shield },
          { title: "AI nastavení", href: "/admin/ai", icon: Bot },
        ]
      : []),
    // Nápověda pro všechny přihlášené (návod + přehled novinek).
    { title: "Nápověda", href: "/napoveda", icon: LifeBuoy },
  ];

  return (
    <Sidebar collapsible="icon">
      {/* Logo + tlačítko na sbalení panelu (u loga, ne v liště vedle — přání
          Hany). Sbalovací tlačítko zmizí ve sbaleném (ikonovém) režimu; zpět se
          panel otevře přepínačem v horní liště (HeaderSidebarToggle). */}
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <SidebarMenu className="flex-1">
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label="Sbalit panel"
            className="shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
          >
            <PanelLeftClose />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const showNews = item.href === "/napoveda" && hasNews;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={
                        showNews ? `${item.title} — nové novinky` : item.title
                      }
                      className="relative"
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {showNews && (
                        <span
                          aria-hidden="true"
                          title="Nové novinky"
                          className="absolute right-2 top-1/2 size-2 -translate-y-1/2 rounded-full bg-pb group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1.5 group-data-[collapsible=icon]:translate-y-0"
                        />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
        <DropdownMenuItem render={<Link href="/nastaveni" />}>
          <Settings aria-hidden="true" />
          Nastavení
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut aria-hidden="true" />
          Odhlásit se
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
