"use client";

import { useState } from "react";
import Image from "next/image";
import { Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";

type AdminUser = {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  canCreateProjects: boolean;
  isAdmin: boolean;
  createdAt: Date;
};

// Řádek uživatele s přepínačem „smí zakládat projekty".
// Klientská komponenta — přepínač volá PATCH API a ukazuje výsledek hned.
export function UserRow({ user }: { user: AdminUser }) {
  const [canCreate, setCanCreate] = useState(user.canCreateProjects);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const next = !canCreate;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canCreateProjects: next }),
      });
      if (!res.ok) throw new Error();
      setCanCreate(next);
    } catch {
      setError("Uložení se nepovedlo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Tr>
      <Td className="font-medium text-ink">
        <span className="flex items-center gap-2.5">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={28}
              height={28}
              className="rounded-full ring-1 ring-line"
              unoptimized
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          {user.name}
        </span>
      </Td>
      <Td>{user.email}</Td>
      <Td>{new Date(user.createdAt).toLocaleDateString("cs-CZ")}</Td>
      <Td>
        {user.isAdmin ? (
          <Badge tone="pb">Admin</Badge>
        ) : (
          <Badge tone="neutral">Uživatel</Badge>
        )}
      </Td>
      <Td>
        <span className="flex items-center gap-2">
          <Checkbox
            checked={canCreate}
            onChange={toggle}
            disabled={saving}
            label={canCreate ? "Ano" : "Ne"}
          />
          {error && <span className="text-xs text-error">{error}</span>}
        </span>
      </Td>
    </Tr>
  );
}
