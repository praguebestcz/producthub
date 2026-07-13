"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserCheck, UserX } from "lucide-react";
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

// Řádek uživatele: přepínač „smí zakládat projekty" + deaktivace/aktivace účtu
// + smazání (jen účet bez projektů a obsahu, `canDelete` počítá server).
// Sám sebe deaktivovat/smazat nejde (hlídá i server); živého admina server odmítne.
export function UserRow({
  user,
  myId,
  canDelete,
}: {
  user: AdminUser;
  myId: number;
  canDelete: boolean;
}) {
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

  async function deleteUser() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Účet ${user.name} byl smazán.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smazání se nepovedlo.");
    } finally {
      setSaving(false);
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
        <span className="flex items-center justify-end gap-2">
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

          {/* Smazat — jen účet bez projektů a obsahu (server to hlídá znovu). */}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    className="text-destructive hover:text-destructive"
                  />
                }
              >
                <Trash2 />
                Smazat
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Smazat účet {user.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Účet nemá žádné projekty ani vytvořený obsah, takže se
                    nic dalšího neztratí. Smazání je nevratné — kdyby se
                    uživatel přihlásil znovu, vznikne mu nový prázdný účet.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Zrušit</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteUser}>
                    Smazat účet
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </span>
      </TableCell>
    </TableRow>
  );
}
