"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Dialog pro založení projektu (jen uživatelé s canCreateProjects — tlačítko
// se jinde ani nevykreslí). Po založení přesměruje na detail projektu.
export function NewProjectDialog({
  clients,
}: {
  clients: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // "none" = bez klienta (Select neumí prázdnou hodnotu)
  const [clientId, setClientId] = useState<string>("none");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          clientId: clientId === "none" ? null : Number(clientId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Projekt „${data.name}" založen.`);
      setOpen(false);
      router.push(`/projects/${data.id}`);
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
        Nový projekt
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nový projekt</DialogTitle>
            <DialogDescription>
              Projekt drží pohromadě specifikaci, recenzenty a jejich
              připomínky.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="np-name">Název *</Label>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Např. Diskuse k produktům (SFX)"
                maxLength={200}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-desc">Popis</Label>
              <Textarea
                id="np-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Krátce: co se připomínkuje a pro koho."
                maxLength={5000}
              />
            </div>
            {clients.length > 0 && (
              <div className="grid gap-1.5">
                <Label>Klient</Label>
                <Select
                  value={clientId}
                  onValueChange={(v) => setClientId(v ?? "none")}
                  items={[
                    { value: "none", label: "— Bez klienta —" },
                    ...clients.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                    })),
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Bez klienta —</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Zakládám…" : "Založit projekt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
