"use client";

import { useState } from "react";

type AdminUser = {
  id: number;
  email: string;
  name: string;
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
    <tr className="border-b border-line-soft last:border-0">
      <td className="px-4 py-3 font-medium">{user.name}</td>
      <td className="px-4 py-3 text-ink-2">{user.email}</td>
      <td className="px-4 py-3 text-ink-3">
        {new Date(user.createdAt).toLocaleDateString("cs-CZ")}
      </td>
      <td className="px-4 py-3">{user.isAdmin ? "Ano" : "—"}</td>
      <td className="px-4 py-3">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={canCreate}
            onChange={toggle}
            disabled={saving}
            className="h-4 w-4 accent-pb"
          />
          <span className="text-ink-2">{canCreate ? "Ano" : "Ne"}</span>
          {error && <span className="text-xs text-error">{error}</span>}
        </label>
      </td>
    </tr>
  );
}
