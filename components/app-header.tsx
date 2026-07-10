import Link from "next/link";
import type { User } from "@prisma/client";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserMenu } from "@/components/user-menu";

// Hlavička aplikace pro přihlášené stránky — sticky s jemným rozostřením pozadí,
// logo vlevo, vpravo přepínač režimu a menu uživatele.
export function AppHeader({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="rounded-lg transition-opacity hover:opacity-80"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu
            user={{
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              isAdmin: user.isAdmin,
            }}
          />
        </div>
      </div>
    </header>
  );
}
