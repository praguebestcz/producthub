"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { ProjectRole } from "@prisma/client";
import { ROLE_LABELS, ROLE_HINTS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES: ProjectRole[] = ["COMMENTER", "READER", "AUTHOR"];

// Pozvání člena e-mailem. Když už má účet, je členem hned; jinak se členem
// stane při prvním přihlášení přes Google (aplikace zatím neposílá e-maily —
// odkaz na aplikaci pošlete pozvanému sami).
export function InviteForm({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("COMMENTER");
  const [isInternal, setIsInternal] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, isInternal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.immediate
          ? `${email} je teď členem projektu.`
          : `Pozvánka pro ${email} čeká na první přihlášení.`,
      );
      setEmail("");
      setRole("COMMENTER");
      setIsInternal(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pozvání se nepovedlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="inv-email">E-mail (Google účet) *</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jmeno@firma.cz"
              maxLength={320}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as ProjectRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              {/* V seznamu jen názvy rolí — dlouhé popisky rozbíjely šířku
                  popupu (screenshot Hany 2026-07-10). Vysvětlení je pod polem. */}
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_HINTS[role]}</p>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isInternal} onCheckedChange={setIsInternal} />
              Interní člen (vidí interní komentáře)
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving || !email.trim()}>
              <UserPlus />
              {saving ? "Zvu…" : "Pozvat"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Aplikace zatím neposílá e-maily — odkaz na aplikaci pošlete
              pozvanému sami. Členem se stane po přihlášení přes Google.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
