"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Scope = "ALL" | "INVOLVED";

const OPTIONS: { value: Scope; title: string; desc: string }[] = [
  {
    value: "ALL",
    title: "Veškeré dění v mých dokumentech",
    desc: "Nový komentář, odpověď, @zmínka i změna stavu vlákna v projektech, kterých jsem členem.",
  },
  {
    value: "INVOLVED",
    title: "Jen když jsem zapojen",
    desc: "Jen když mě někdo @zmíní nebo odpoví / změní stav ve vláknu, které jsem založil nebo v něm psal. Nové komentáře, kde nejsem, mě neupozorní.",
  },
];

// Přepínač rozsahu notifikací (zvoneček). Ukládá se hned po výběru.
export function NotifyScopeSetting({ initial }: { initial: Scope }) {
  const [scope, setScope] = useState<Scope>(initial);
  const [saving, setSaving] = useState(false);

  async function save(next: Scope) {
    if (next === scope || saving) return;
    const prev = scope;
    setScope(next);
    setSaving(true);
    try {
      const res = await fetch("/api/me/notification-scope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyScope: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Nastavení uloženo.");
    } catch (e) {
      setScope(prev);
      toast.error(e instanceof Error ? e.message : "Uložení se nepovedlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pb-soft text-pb">
          <Bell size={18} aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold">Upozornění (zvoneček)</h3>
          <p className="text-sm text-muted-foreground">
            Kdy vám má chodit upozornění na dění v dokumentech.
          </p>
        </div>
      </div>

      <div role="radiogroup" className="grid gap-2">
        {OPTIONS.map((o) => {
          const active = scope === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => save(o.value)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-pb bg-pb-soft/50 ring-1 ring-pb/30"
                  : "hover:border-foreground/25",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-pb bg-pb text-white" : "border-muted-foreground/40",
                )}
              >
                {active && <Check size={11} strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {o.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
