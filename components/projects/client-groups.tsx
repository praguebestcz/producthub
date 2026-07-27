"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  FileText,
  MessageSquare,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roles";
import { plural } from "@/lib/czech";
import { cn } from "@/lib/utils";

export type ProjectCardData = {
  id: number;
  name: string;
  description: string | null;
  role: "AUTHOR" | "COMMENTER" | "READER";
  documents: number;
  members: number;
  open: number;
};

export type ClientGroup = {
  key: string; // stabilní klíč (název klienta nebo "__none")
  name: string; // zobrazený název ("" → Nezařazené)
  projects: ProjectCardData[];
};

// Kam si prohlížeč pamatuje, které skupiny klientů má uživatel rozbalené (bez DB).
const STORAGE_KEY = "ph-client-groups-open";

// Seznam projektů seskupený podle klienta se sbalitelnými skupinami.
// Výchozí stav: jeden klient → rozbaleno (klient s jedním projektem ho vidí
// hned); víc klientů → sbaleno kvůli přehlednosti. Uložený stav (localStorage)
// má přednost, per klient. Na hlavičce i ve sbaleném stavu vidět počet projektů
// a odznak nevyřešených, aby bylo jasné, kde čeká práce.
export function ClientGroups({ groups }: { groups: ClientGroup[] }) {
  const singleGroup = groups.length === 1;
  // Initializer NEČTE localStorage → server i první klientský render dají stejné
  // HTML (žádný hydration mismatch); uložený stav se dorovná v useEffect.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, singleGroup])),
  );

  useEffect(() => {
    let stored: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = {};
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(
      Object.fromEntries(
        groups.map((g) => [
          g.key,
          typeof stored[g.key] === "boolean" ? stored[g.key] : singleGroup,
        ]),
      ),
    );
    // groups jsou v rámci jednoho načtení stránky stabilní.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: string) {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage nedostupné (privátní režim) — stav jen pro tuto session.
      }
      return next;
    });
  }

  return (
    <div className="mt-8 grid gap-4">
      {groups.map((g) => {
        const isOpen = open[g.key] ?? singleGroup;
        const openTotal = g.projects.reduce((s, p) => s + p.open, 0);
        return (
          <section key={g.key}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight
                size={15}
                aria-hidden="true"
                className={cn(
                  "shrink-0 transition-transform",
                  isOpen && "rotate-90",
                )}
              />
              <Building2 size={15} aria-hidden="true" className="shrink-0" />
              <span className="uppercase tracking-wide">
                {g.name || "Nezařazené"}
              </span>
              <span className="font-normal">({g.projects.length})</span>
              {openTotal > 0 && (
                <span
                  className="ml-1 flex items-center gap-1 font-medium text-pb"
                  title="Nevyřešené komentáře"
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  {openTotal}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`}>
                    <Card className="h-full transition-all hover:border-pb/40 hover:shadow-md">
                      <CardContent className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold leading-snug">
                            {p.name}
                          </h3>
                          <Badge
                            variant={
                              p.role === "AUTHOR" ? "default" : "secondary"
                            }
                          >
                            {ROLE_LABELS[p.role]}
                          </Badge>
                        </div>
                        {p.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {p.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText size={13} aria-hidden="true" />
                            {p.documents}{" "}
                            {plural(
                              p.documents,
                              "dokument",
                              "dokumenty",
                              "dokumentů",
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={13} aria-hidden="true" />
                            {p.members}{" "}
                            {plural(p.members, "člen", "členové", "členů")}
                          </span>
                          {p.open > 0 && (
                            <span
                              className="flex items-center gap-1 font-medium text-pb"
                              title="Nevyřešené komentáře"
                            >
                              <MessageSquare size={13} aria-hidden="true" />
                              {p.open}{" "}
                              {plural(
                                p.open,
                                "nevyřešený",
                                "nevyřešené",
                                "nevyřešených",
                              )}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
