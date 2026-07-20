"use client";

import { useState } from "react";
import { KeyRound, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export type ApiKeyStatus = {
  source: "db" | "env" | "none";
  last4: string | null;
};
export type AiUsageSummary = {
  count: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costCzk: number;
};
export type AiConfig = {
  apiKey: ApiKeyStatus;
  monthlyGenerationLimit: number;
  usage: AiUsageSummary;
};

function keyStatusText(k: ApiKeyStatus): string {
  if (k.source === "db") return `Nastaveno v aplikaci · sk-ant-…${k.last4}`;
  if (k.source === "env") return `Z proměnné prostředí (env) · …${k.last4}`;
  return "Nenastaveno";
}

export function AiConfigForm({ initial }: { initial: AiConfig }) {
  const [cfg, setCfg] = useState<AiConfig>(initial);
  const [newKey, setNewKey] = useState("");
  const [limit, setLimit] = useState(String(initial.monthlyGenerationLimit));
  const [busy, setBusy] = useState<null | "key" | "clear" | "limit">(null);

  async function patch(
    body: Record<string, unknown>,
    which: "key" | "clear" | "limit",
  ): Promise<boolean> {
    setBusy(which);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCfg(data);
      setLimit(String(data.monthlyGenerationLimit));
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení se nezdařilo.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveKey() {
    if (!newKey.trim()) return;
    if (await patch({ anthropicApiKey: newKey.trim() }, "key")) {
      setNewKey("");
      toast.success("Klíč uložen.");
    }
  }
  async function clearKey() {
    if (await patch({ anthropicApiKey: null }, "clear")) {
      toast.success("Klíč smazán z aplikace (použije se env, pokud je).");
    }
  }
  async function saveLimit() {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Zadejte celé nezáporné číslo (0 = bez limitu).");
      return;
    }
    if (await patch({ monthlyGenerationLimit: n }, "limit")) {
      toast.success("Limit uložen.");
    }
  }

  const u = cfg.usage;

  return (
    <div className="mt-8 grid gap-6">
      {/* API klíč */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pb-soft text-pb">
              <KeyRound size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">Anthropic API klíč</h2>
              <p className="text-xs text-muted-foreground">
                Klíč pro generování promptů přes Claude. Ukládá se šifrovaně,
                nikdy se nezobrazuje celý.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Stav:</span>
            <Badge
              variant={cfg.apiKey.source === "none" ? "outline" : "secondary"}
            >
              {keyStatusText(cfg.apiKey)}
            </Badge>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-key">Nový klíč (sk-ant-…)</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                placeholder="sk-ant-…"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="max-w-md"
              />
              <Button disabled={busy !== null || !newKey.trim()} onClick={saveKey}>
                {busy === "key" ? <Loader2 className="animate-spin" /> : <Save />}
                Uložit klíč
              </Button>
              {cfg.apiKey.source === "db" && (
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={clearKey}
                  className="text-destructive hover:text-destructive"
                >
                  {busy === "clear" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                  Smazat klíč z aplikace
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Klíč z aplikace přebíjí proměnnou prostředí. Po smazání se použije
              env (pokud je nastavená).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Měsíční limit */}
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="font-semibold">Měsíční limit generování</h2>
            <p className="text-xs text-muted-foreground">
              Kolik AI generování se smí za kalendářní měsíc vytvořit. 0 = bez
              limitu.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ai-limit">Limit (počet / měsíc)</Label>
              <Input
                id="ai-limit"
                type="number"
                min={0}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={saveLimit}
            >
              {busy === "limit" ? <Loader2 className="animate-spin" /> : <Save />}
              Uložit limit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Přehled spotřeby */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-semibold">Přehled tento měsíc</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Generování"
              value={
                cfg.monthlyGenerationLimit > 0
                  ? `${u.count} / ${cfg.monthlyGenerationLimit}`
                  : `${u.count}`
              }
            />
            <Stat
              label="Tokeny (vstup + výstup)"
              value={`${u.inputTokens.toLocaleString("cs-CZ")} + ${u.outputTokens.toLocaleString("cs-CZ")}`}
            />
            <Stat
              label="Odhad ceny"
              value={`~${u.costCzk.toFixed(2)} Kč ($${u.costUsd.toFixed(4)})`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Cena je odhad podle ceníku modelu a přibližného kurzu - ber jako
            orientační.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
