"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { plural } from "@/lib/czech";

type Client = {
  id: number;
  name: string;
  projects: number;
  createdAt: Date;
};

// Dialog založení klienta.
export function NewClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Klient „${data.name}" založen.`);
      setOpen(false);
      setName("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Založení se nepovedlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Nový klient
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nový klient</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 py-4">
            <Label htmlFor="nc-name">Název *</Label>
            <Input
              id="nc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Foto Škoda"
              maxLength={120}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Zakládám…" : "Založit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Tabulka klientů s přejmenováním a mazáním.
export function ClientsTable({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Client | null>(null);
  const [newName, setNewName] = useState("");

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${renaming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Přejmenováno na „${data.name}".`);
      setRenaming(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Přejmenování se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(client: Client) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Klient „${client.name}" smazán.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smazání se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  if (clients.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center px-8 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pb-soft text-pb">
            <Building2 size={26} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-lg font-semibold">Zatím žádní klienti</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Založte prvního klienta — projekty pak půjde zařadit do složek
            podle klienta (včetně interních projektů PB).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Klient</TableHead>
              <TableHead>Projekty</TableHead>
              <TableHead>Vytvořen</TableHead>
              <TableHead className="w-24" aria-label="Akce" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-pb-soft text-pb">
                      <Building2 size={14} aria-hidden="true" />
                    </span>
                    {c.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.projects}{" "}
                  {plural(c.projects, "projekt", "projekty", "projektů")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString("cs-CZ")}
                </TableCell>
                <TableCell>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => {
                        setRenaming(c);
                        setNewName(c.name);
                      }}
                      aria-label={`Přejmenovat ${c.name}`}
                    >
                      <Pencil />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label={`Smazat ${c.name}`}
                          />
                        }
                      >
                        <Trash2 className="text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Smazat klienta „{c.name}&ldquo;?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {c.projects > 0
                              ? `Klient má ${c.projects} ${plural(c.projects, "projekt", "projekty", "projektů")} — smazání se nepovede, dokud je nepřesunete nebo nesmažete.`
                              : "Klient nemá žádné projekty, smazání je bezpečné."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Zrušit</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(c)}>
                            Smazat
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog přejmenování */}
      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <form onSubmit={rename}>
            <DialogHeader>
              <DialogTitle>Přejmenovat klienta</DialogTitle>
            </DialogHeader>
            <div className="grid gap-1.5 py-4">
              <Label htmlFor="rc-name">Název *</Label>
              <Input
                id="rc-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(null)}
              >
                Zrušit
              </Button>
              <Button type="submit" disabled={busy || !newName.trim()}>
                {busy ? "Ukládám…" : "Přejmenovat"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
