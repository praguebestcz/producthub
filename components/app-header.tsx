import Link from "next/link";
import Image from "next/image";
import { Shield } from "lucide-react";
import type { User } from "@prisma/client";
import { APP_NAME } from "@/lib/app-info";

// Hlavička aplikace pro přihlášené stránky — logo, admin odkaz, uživatel, odhlášení.
// Server komponenta; odhlášení je klasický <form> POST (žádný JS není potřeba).
export function AppHeader({ user }: { user: User }) {
  return (
    <header className="border-b border-line bg-bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {APP_NAME}
        </Link>

        <div className="flex items-center gap-4">
          {user.isAdmin && (
            <Link
              href="/admin/users"
              className="flex items-center gap-1.5 text-sm text-ink-2 transition hover:text-ink"
            >
              <Shield size={16} aria-hidden="true" />
              Správa uživatelů
            </Link>
          )}

          <div className="flex items-center gap-2">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={28}
                height={28}
                className="rounded-full"
                unoptimized
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-xs font-medium"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-sm text-ink-2">{user.name}</span>
          </div>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:bg-line-soft"
            >
              Odhlásit se
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
