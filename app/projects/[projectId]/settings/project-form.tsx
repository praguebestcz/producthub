"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

// Úprava základních údajů projektu. `constraints` se v M8 vkládají do každého
// Claude promptu — proto jsou tady od začátku. Zařazení pod klienta mění jen
// tým s canCreateProjects (expert review M3.5).
export function ProjectForm({
  project,
  clients,
  canChangeClient,
}: {
  project: {
    id: number;
    name: string;
    description: string | null;
    constraints: string | null;
    clientId: number | null;
    clientName: string | null;
  };
  clients: { id: number; name: string }[];
  canChangeClient: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [constraints, setConstraints] = useState(project.constraints ?? "");
  const [clientId, setClientId] = useState<string>(
    project.clientId ? String(project.clientId) : "none",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          constraints: constraints || null,
          // clientId posílat jen když ho uživatel smí měnit (server to hlídá taky)
          ...(canChangeClient
            ? { clientId: clientId === "none" ? null : Number(clientId) }
            : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Uloženo.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení se nepovedlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-name">Název *</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-desc">Popis</Label>
            <Textarea
              id="pf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              placeholder="Krátce: co se připomínkuje a pro koho."
            />
          </div>
          {canChangeClient ? (
            <div className="grid gap-1.5">
              <Label>Klient</Label>
              <Select
                value={clientId}
                onValueChange={(v) => setClientId(v ?? "none")}
                // items = mapa hodnota → popisek; bez ní SelectValue ukazuje
                // syrové ID (bug nahlášený Hanou)
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
          ) : (
            project.clientName && (
              <div className="grid gap-1.5">
                <Label>Klient</Label>
                <p className="text-sm text-muted-foreground">
                  {project.clientName}
                </p>
              </div>
            )
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pf-constraints">Omezení pro implementaci</Label>
            <Textarea
              id="pf-constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              maxLength={5000}
              placeholder={"Např. „Neměnit design systém, zachovat data-review-id atributy.“"}
            />
            <p className="text-xs text-muted-foreground">
              Vloží se do každého vygenerovaného Claude promptu.
            </p>
          </div>
          <div>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Ukládám…" : "Uložit změny"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
