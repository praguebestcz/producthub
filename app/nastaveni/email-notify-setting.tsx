"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "OFF" | "IMMEDIATE" | "UNREAD";

const OPTIONS: { value: Mode; title: string; desc: string }[] = [
  {
    value: "OFF",
    title: "Vypnuto",
    desc: "Žádné e-maily. Upozornění vidíte jen ve zvonečku v aplikaci.",
  },
  {
    value: "IMMEDIATE",
    title: "Okamžitě",
    desc: "E-mail dorazí hned, jak vznikne upozornění (odpověď, @zmínka, změna stavu vlákna).",
  },
  {
    value: "UNREAD",
    title: "Jen nepřečtené (chytře)",
    desc: "E-mail dorazí jen na to, co jste si v aplikaci nestihli přečíst do pár minut. Kdo je v appce aktivní, e-maily nedostává.",
  },
];

// Přepínač režimu e-mailových notifikací. Ukládá se hned po výběru. Respektuje
// stejný rozsah (vše / jen zapojen) jako zvoneček - jde jen o způsob doručení.
export function EmailNotifySetting({ initial }: { initial: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [saving, setSaving] = useState(false);

  async function save(next: Mode) {
    if (next === mode || saving) return;
    const prev = mode;
    setMode(next);
    setSaving(true);
    try {
      const res = await fetch("/api/me/email-notify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotify: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Nastavení uloženo.");
    } catch (e) {
      setMode(prev);
      toast.error(e instanceof Error ? e.message : "Uložení se nepovedlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pb-soft text-pb">
          <Mail size={18} aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold">E-mailová upozornění</h3>
          <p className="text-sm text-muted-foreground">
            Zda a jak vám mají upozornění chodit i e-mailem.
          </p>
        </div>
      </div>

      <div role="radiogroup" className="grid gap-2">
        {OPTIONS.map((o) => {
          const active = mode === o.value;
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
                  active
                    ? "border-pb bg-pb text-white"
                    : "border-muted-foreground/40",
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
