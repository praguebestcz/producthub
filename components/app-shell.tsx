import type { User } from "@prisma/client";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderSidebarToggle } from "@/components/header-sidebar-toggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { WhatsNewDialog } from "@/components/whats-new-dialog";

// Kostra přihlášené aplikace: sbalitelné boční menu vlevo (preference Hany)
// + tenká horní lišta (tlačítko sbalení, vpravo přepínač režimu) + obsah.
// Stav sbalení si SidebarProvider pamatuje sám (cookie).
export function AppShell({
  user,
  children,
  fullWidth = false,
}: {
  user: User;
  children: React.ReactNode;
  // fullWidth = obsah přes celou šířku (bez max-w, menší okraje). Pro prohlížeč
  // dokumentu, kde je potřeba co nejvíc místa (přání Hany).
  fullWidth?: boolean;
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          isAdmin: user.isAdmin,
          canCreateProjects: user.canCreateProjects,
        }}
      />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
          <HeaderSidebarToggle />
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <main
          className={
            fullWidth
              ? "w-full flex-1 px-4 py-5"
              : "mx-auto w-full max-w-6xl flex-1 px-6 py-8"
          }
        >
          {children}
        </main>
      </SidebarInset>
      {/* Okno uvítání / „Co je nového" — rozhodne se samo podle prohlížeče. */}
      <WhatsNewDialog />
    </SidebarProvider>
  );
}
