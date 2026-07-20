"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Copy,
  Download,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { findClarifications } from "@/lib/comments/prompt";

// „Zadání" (M8) — uložený prompt z komentářů pro Claude Code.
export type PromptExportStatus = "CREATED" | "HANDED_OFF" | "DONE";
export type PromptExportRecord = {
  id: number;
  title: string;
  body: string;
  status: PromptExportStatus;
  commentIds: number[];
  documentVersionId: number;
  createdAt: string;
  createdBy: { id: number; name: string };
};

const STATUS_LABEL: Record<PromptExportStatus, string> = {
  CREATED: "Vytvořeno",
  HANDED_OFF: "Předáno vývoji",
  DONE: "Zapracováno",
};
const STATUS_ORDER: PromptExportStatus[] = ["CREATED", "HANDED_OFF", "DONE"];

// Odstraní diakritiku a nebezpečné znaky → bezpečný název souboru.
function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "dokument"
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Zkopírováno do schránky.");
  } catch {
    toast.error("Kopírování se nezdařilo. Zkuste stáhnout .md.");
  }
}

function downloadMarkdown(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: PromptExportStatus }) {
  return (
    <Badge
      variant={status === "DONE" ? "secondary" : "outline"}
      className={cn(
        "text-[11px]",
        status === "HANDED_OFF" && "border-pb/30 bg-pb-soft text-pb",
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// Upozornění na body, které AI označila jako „k upřesnění" — dokud jsou
// v textu, autor má co doplnit. Seznam se počítá živě z aktuálního textu.
function ClarificationBanner({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const MAX_SHOWN = 3;
  const shown = items.slice(0, MAX_SHOWN);
  const rest = items.length - shown.length;
  return (
    <div className="shrink-0 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={14} aria-hidden="true" />
        {items.length}{" "}
        {items.length === 1
          ? "místo k upřesnění"
          : items.length >= 2 && items.length <= 4
            ? "místa k upřesnění"
            : "míst k upřesnění"}{" "}
        — v textu níže jsou označené značkou ⚠️ K upřesnění: — doplňte je a
        uložte.
      </p>
      <ul className="mt-1.5 ml-1 list-disc space-y-0.5 pl-4">
        {shown.map((it, i) => (
          <li key={i} className="line-clamp-1">
            {it}
          </li>
        ))}
        {rest > 0 && (
          <li className="list-none font-medium">…a další {rest} v textu níže</li>
        )}
      </ul>
    </div>
  );
}

// Okno pro VYTVOŘENÍ zadání — editovatelný název + text promptu, uložení
// + kopie/stažení. Text se generuje v prohlížeči a předává přes defaultBody.
export function CreatePromptDialog({
  open,
  onOpenChange,
  documentId,
  documentVersionId,
  documentName,
  defaultTitle,
  defaultBody,
  commentIds,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: number;
  documentVersionId: number;
  documentName: string;
  defaultTitle: string;
  defaultBody: string;
  commentIds: number[];
  onCreated: (record: PromptExportRecord) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [busy, setBusy] = useState(false);
  // Doplnění pro AI (odpovědi na „k upřesnění") + probíhající přegenerování.
  const [clarifyNote, setClarifyNote] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  // Nový vygenerovaný prompt (defaultBody se změní) → přenačíst pole.
  const [prevBody, setPrevBody] = useState(defaultBody);
  if (prevBody !== defaultBody) {
    setPrevBody(defaultBody);
    setTitle(defaultTitle);
    setBody(defaultBody);
    setClarifyNote("");
  }

  // „Doplnit a přegenerovat": pošle AI původní komentáře + doplnění autora,
  // ta vyřeší nejasnosti a vrátí nový prompt (nahradí text v okně).
  async function regenerate() {
    if (!clarifyNote.trim()) return;
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/prompt-exports/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentVersionId,
            commentIds,
            clarification: clarifyNote,
            // Pošli aktuální text (i s ručními úpravami) — AI ho zpřesní, nezahodí.
            currentDraft: body,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBody(data.body);
      setClarifyNote("");
      toast.success("Prompt přegenerován s doplněním.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Přegenerování se nezdařilo.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function save(then: "copy" | "download") {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/prompt-exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentVersionId,
          title,
          body,
          commentIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data.export);
      if (then === "copy") await copyText(body);
      else downloadMarkdown(`pripominky-${slugify(documentName)}.md`, body);
      toast.success("Zadání uloženo.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení se nezdařilo.");
    } finally {
      setBusy(false);
    }
  }

  // Body „k upřesnění" se počítají živě z textu — jak je autor doplní, mizí.
  const clarifications = findClarifications(body);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[92vw] max-w-4xl flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Prompt z komentářů</DialogTitle>
          <DialogDescription>
            Zkontrolujte a případně upravte text, pak uložte jako zadání.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="pe-title">Název zadání</Label>
          <Input
            id="pe-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <ClarificationBanner items={clarifications} />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
          className="min-h-[25vh] flex-1 resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {/* Doplnit odpovědi na „k upřesnění" a nechat AI přegenerovat */}
        <div className="space-y-1.5 rounded-md border border-dashed p-2.5">
          <Label htmlFor="pe-clarify" className="text-xs font-medium">
            Doplnit pro AI a přegenerovat
          </Label>
          <textarea
            id="pe-clarify"
            value={clarifyNote}
            onChange={(e) => setClarifyNote(e.target.value)}
            rows={2}
            placeholder="Odpovězte na otázky „k upřesnění“ nebo přidejte kontext, AI z toho udělá konkrétní změny…"
            className="w-full resize-none rounded-md border bg-background p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={regenerating || !clarifyNote.trim()}
            onClick={regenerate}
          >
            {regenerating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {regenerating ? "Generuji…" : "Doplnit a přegenerovat"}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Zavřít
          </Button>
          <Button
            variant="outline"
            disabled={busy || regenerating || !title.trim() || !body.trim()}
            onClick={() => save("download")}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Uložit a stáhnout .md
          </Button>
          <Button
            disabled={busy || regenerating || !title.trim() || !body.trim()}
            onClick={() => save("copy")}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Copy />}
            Uložit a zkopírovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Okno „Předaná zadání" — seznam uložených zadání + prohlížení jednoho
// (kopie/stažení) + změna stavu. Jen pro interní tým (přístup hlídá API).
export function PromptExportsDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  canManage,
  currentUserId,
  isAuthor,
  onCountChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: number;
  documentName: string;
  canManage: boolean;
  currentUserId: number;
  isAuthor: boolean;
  onCountChange?: (n: number) => void;
}) {
  const [items, setItems] = useState<PromptExportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<PromptExportRecord | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Které zadání se právě ptá na potvrzení smazání (inline, bez dalšího okna).
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function deleteExport(rec: PromptExportRecord) {
    setBusyId(rec.id);
    try {
      const res = await fetch(`/api/prompt-exports/${rec.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const next = items.filter((x) => x.id !== rec.id);
      setItems(next);
      onCountChange?.(next.length);
      setConfirmDeleteId(null);
      toast.success("Zadání smazáno.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání se nezdařilo.");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    // Načtení seznamu při otevření okna (externí data) — reset stavu je zde
    // záměrný, ne odvozený stav.
    /* eslint-disable react-hooks/set-state-in-effect */
    setViewing(null);
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/documents/${documentId}/prompt-exports`)
      .then((r) => r.json())
      .then((d) => {
        if (d.exports) {
          setItems(d.exports);
          onCountChange?.(d.exports.length);
        }
      })
      .catch(() => toast.error("Zadání se nepodařilo načíst."))
      .finally(() => setLoading(false));
    // onCountChange je stabilní callback z rodiče; nepatří do deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  async function changeStatus(rec: PromptExportRecord, status: PromptExportStatus) {
    if (status === rec.status) return;
    setBusyId(rec.id);
    try {
      const res = await fetch(`/api/prompt-exports/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((list) =>
        list.map((x) => (x.id === rec.id ? { ...x, status } : x)),
      );
      setViewing((v) => (v && v.id === rec.id ? { ...v, status } : v));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Změna se nezdařila.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[92vw] max-w-4xl flex-col overflow-hidden sm:max-w-4xl">
        {viewing ? (
          <>
            <DialogHeader>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={13} /> Zpět na seznam
              </button>
              <DialogTitle className="mt-1">{viewing.title}</DialogTitle>
              <DialogDescription>
                {viewing.createdBy.name} · {formatWhen(viewing.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <ClarificationBanner items={findClarifications(viewing.body)} />
            <pre className="min-h-[45vh] flex-1 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {viewing.body}
            </pre>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  downloadMarkdown(
                    `pripominky-${slugify(documentName)}.md`,
                    viewing.body,
                  )
                }
              >
                <Download />
                Stáhnout .md
              </Button>
              <Button onClick={() => copyText(viewing.body)}>
                <Copy />
                Kopírovat
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList size={18} aria-hidden="true" />
                Předaná zadání
              </DialogTitle>
              <DialogDescription>
                Prompty vytvořené z komentářů tohoto dokumentu.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-[20vh] flex-1 space-y-2 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <p className="px-1 py-10 text-center text-sm text-muted-foreground">
                  Zatím žádná zadání. Vyberte komentáře a vytvořte první.
                </p>
              ) : (
                items.map((rec) => {
                  const openCount = findClarifications(rec.body).length;
                  const canDelete =
                    rec.createdBy.id === currentUserId || isAuthor;
                  return (
                    <div
                      key={rec.id}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {rec.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rec.createdBy.name} · {formatWhen(rec.createdAt)} ·{" "}
                            {rec.commentIds.length}{" "}
                            {rec.commentIds.length === 1
                              ? "komentář"
                              : rec.commentIds.length >= 2 &&
                                  rec.commentIds.length <= 4
                                ? "komentáře"
                                : "komentářů"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={rec.status} />
                          {openCount > 0 && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-300 bg-amber-50 text-[10px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                              title="Zadání ještě obsahuje body k upřesnění"
                            >
                              <AlertTriangle size={10} aria-hidden="true" />
                              {openCount} k upřesnění
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewing(rec)}
                        >
                          Zobrazit
                        </Button>
                        {canManage && (
                          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
                            {STATUS_ORDER.map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={busyId === rec.id}
                                onClick={() => changeStatus(rec, s)}
                                className={cn(
                                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                                  rec.status === s
                                    ? "bg-pb-soft text-pb"
                                    : "text-muted-foreground hover:bg-muted",
                                )}
                              >
                                {STATUS_LABEL[s]}
                              </button>
                            ))}
                          </div>
                        )}
                        {canDelete &&
                          (confirmDeleteId === rec.id ? (
                            <span className="ml-auto flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">
                                Smazat?
                              </span>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busyId === rec.id}
                                onClick={() => deleteExport(rec)}
                              >
                                {busyId === rec.id && (
                                  <Loader2 className="animate-spin" />
                                )}
                                Ano
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Ne
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="ml-auto text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeleteId(rec.id)}
                              aria-label="Smazat zadání"
                            >
                              <Trash2 />
                            </Button>
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
