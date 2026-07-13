"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type AdminUser = {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  canCreateProjects: boolean;
  isAdmin: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
};

// Řádek uživatele: přepínač „smí zakládat projekty" + deaktivace/aktivace účtu.
// Sám sebe deaktivovat nejde (hlídá i server); živého admina server odmítne.
export function UserRow({ user, myId }: { user: AdminUser; myId: number }) {
  const router = useRouter();
  const [canCreate, setCanCreate] = useState(user.canCreateProjects);
  const [saving, setSaving] = useState(false);
  const isMe = user.id === myId;
  const isDeactivated = user.deactivatedAt !== null;

  async function patch(data: { canCreateProjects?: boolean; deactivated?: boolean }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení se nepovedlo.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleCanCreate(next: boolean) {
    if (await patch({ canCreateProjects: next })) {
      setCanCreate(next);
      toast.success(
        next
          ? `${user.name} teď smí zakládat projekty.`
          : `${user.name} už nesmí zakládat projekty.`,
      );
    }
  }

  async function setDeactivated(next: boolean) {
    if (await patch({ deactivated: next })) {
      toast.success(
        next
          ? `Účet ${user.name} byl deaktivován.`
          : `Účet ${user.name} byl znovu aktivován.`,
      );
      router.refresh();
    }
  }

  return (
    <TableRow className={isDeactivated ? "opacity-60" : undefined}>
      <TableCell className="font-medium">
        <span className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.name}
          {isMe && (
            <span className="text-xs text-muted-foreground">(vy)</span>
          )}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString("cs-CZ")}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {user.isAdmin ? (
            <Badge>Admin</Badge>
          ) : (
            <Badge variant="secondary">Uživatel</Badge>
          )}
          {isDeactivated && (
            <Badge variant="destructive">Deaktivovaný</Badge>
          )}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <Switch
            checked={canCreate}
            onCheckedChange={toggleCanCreate}
            disabled={saving || isDeactivated}
            aria-label={`Smí zakládat projekty: ${user.name}`}
          />
          <span className="text-sm text-muted-foreground">
            {canCreate ? "Ano" : "Ne"}
          </span>
        </span>
      </TableCell>
      <TableCell>
        {!isMe &&
          (isDeactivated ? (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setDeactivated(false)}
            >
              <UserCheck />
              Aktivovat
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    className="text-destructive hover:text-destructive"
                  />
                }
              >
                <UserX />
                Deaktivovat
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Deaktivovat účet {user.name}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Uživatel se nebude moci přihlásit a jeho běžící přihlášení
                    okamžitě přestane platit. Komentáře, členství i historie
                    zůstanou zachované. Účet jde kdykoli znovu aktivovat.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Zrušit</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setDeactivated(true)}>
                    Deaktivovat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
      </TableCell>
    </TableRow>
  );
}
