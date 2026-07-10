"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Úprava základních údajů projektu. `constraints` se v M8 vkládají do každého
// Claude promptu — proto jsou tady od začátku.
export function ProjectForm({
  project,
}: {
  project: {
    id: number;
    name: string;
    description: string | null;
    constraints: string | null;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [constraints, setConstraints] = useState(project.constraints ?? "");

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
