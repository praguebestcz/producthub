"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
// Klientská komponenta — přepínač volá PATCH API; výsledek hlásí toastem.
export function UserRow({ user }: { user: AdminUser }) {
  const [canCreate, setCanCreate] = useState(user.canCreateProjects);
  const [saving, setSaving] = useState(false);

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canCreateProjects: next }),
      });
      if (!res.ok) throw new Error();
      setCanCreate(next);
      toast.success(
        next
          ? `${user.name} teď smí zakládat projekty.`
          : `${user.name} už nesmí zakládat projekty.`,
      );
    } catch {
      toast.error("Uložení se nepovedlo. Zkuste to znovu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.name}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString("cs-CZ")}
      </TableCell>
      <TableCell>
        {user.isAdmin ? (
          <Badge>Admin</Badge>
        ) : (
          <Badge variant="secondary">Uživatel</Badge>
        )}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <Switch
            checked={canCreate}
            onCheckedChange={toggle}
            disabled={saving}
            aria-label={`Smí zakládat projekty: ${user.name}`}
          />
          <span className="text-sm text-muted-foreground">
            {canCreate ? "Ano" : "Ne"}
          </span>
        </span>
      </TableCell>
    </TableRow>
  );
}
