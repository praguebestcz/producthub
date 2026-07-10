"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MailQuestion } from "lucide-react";
import { toast } from "sonner";
import type { ProjectRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const ROLES: ProjectRole[] = ["AUTHOR", "COMMENTER", "READER"];

type Member = {
  id: number;
  role: ProjectRole;
  isInternal: boolean;
  user: { id: number; name: string; email: string; avatarUrl: string | null };
};

type Invitation = {
  id: number;
  email: string;
  role: ProjectRole;
  isInternal: boolean;
  createdAt: Date;
};

// Správa členů a čekajících pozvánek v jedné tabulce.
// Vlastní řádek (myMemberId) nejde odebrat ani měnit — ochrana proti zamčení se ven.
export function MembersTable({
  projectId,
  myMemberId,
  members,
  invitations,
}: {
  projectId: number;
  myMemberId: number;
  members: Member[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patchMember(
    memberId: number,
    data: { role?: ProjectRole; isInternal?: boolean },
  ) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Uloženo.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: number, name: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${memberId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`${name} byl odebrán z projektu.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Odebrání se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(invitationId: number, email: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/invitations/${invitationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Pozvánka pro ${email} zrušena.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zrušení se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Člen</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Interní</TableHead>
            <TableHead className="w-14" aria-label="Akce" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const isMe = m.id === myMemberId;
            return (
              <TableRow key={`m-${m.id}`}>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      <AvatarImage src={m.user.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-gradient-to-br from-pb to-pb-orange text-xs font-semibold text-white">
                        {m.user.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {m.user.name}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            (vy)
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.user.email}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  {isMe ? (
                    <Badge>{ROLE_LABELS[m.role]}</Badge>
                  ) : (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        patchMember(m.id, { role: v as ProjectRole })
                      }
                      disabled={busy}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={m.isInternal || m.role === "AUTHOR"}
                    onCheckedChange={(v) =>
                      patchMember(m.id, { isInternal: v })
                    }
                    disabled={busy || isMe || m.role === "AUTHOR"}
                    aria-label={`Interní člen: ${m.user.name}`}
                  />
                </TableCell>
                <TableCell>
                  {!isMe && (
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label={`Odebrat ${m.user.name}`}
                          />
                        }
                      >
                        <Trash2 className="text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Odebrat {m.user.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Ztratí přístup k projektu. Jeho komentáře
                            zůstanou zachované.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Zrušit</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeMember(m.id, m.user.name)}
                          >
                            Odebrat
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            );
          })}

          {invitations.map((inv) => (
            <TableRow key={`i-${inv.id}`}>
              <TableCell>
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <MailQuestion size={14} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {inv.email}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Čeká na první přihlášení
                    </span>
                  </span>
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {inv.isInternal ? "Ano" : "Ne"}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => revokeInvitation(inv.id, inv.email)}
                  aria-label={`Zrušit pozvánku pro ${inv.email}`}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
