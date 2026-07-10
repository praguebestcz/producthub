import Link from "next/link";
import Image from "next/image";
import { Shield, LogOut } from "lucide-react";
import type { User } from "@prisma/client";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Hlavička aplikace pro přihlášené stránky — sticky s jemným rozostřením pozadí,
// logo vlevo, vpravo admin odkaz, přepínač režimu, uživatel a odhlášení.
// Server komponenta; odhlášení je klasický <form> POST (žádný JS není potřeba).
export function AppHeader({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="rounded-lg transition-opacity hover:opacity-80"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-1.5">
          {user.isAdmin && (
            <Link
              href="/admin/users"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-line-soft hover:text-ink"
            >
              <Shield size={15} aria-hidden="true" />
              Uživatelé
            </Link>
          )}

          <ThemeToggle />

          {/* Uživatel — jemná „pilulka" s avatarem */}
          <div className="ml-1 flex items-center gap-2 rounded-full border border-line bg-bg-subtle py-1 pl-1 pr-3">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={26}
                height={26}
                className="rounded-full ring-1 ring-line"
                unoptimized
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="max-w-[160px] truncate text-sm font-medium text-ink-2">
              {user.name}
            </span>
          </div>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              title="Odhlásit se"
              aria-label="Odhlásit se"
              className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
