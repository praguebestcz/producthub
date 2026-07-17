"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Download,
  Loader2,
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
  // Nový vygenerovaný prompt (defaultBody se změní) → přenačíst pole.
  const [prevBody, setPrevBody] = useState(defaultBody);
  if (prevBody !== defaultBody) {
    setPrevBody(defaultBody);
    setTitle(defaultTitle);
    setBody(defaultBody);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
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
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
          className="min-h-[40vh] flex-1 resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Zavřít
          </Button>
          <Button
            variant="outline"
            disabled={busy || !title.trim() || !body.trim()}
            onClick={() => save("download")}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Uložit a stáhnout .md
          </Button>
          <Button
            disabled={busy || !title.trim() || !body.trim()}
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
  onCountChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: number;
  documentName: string;
  canManage: boolean;
  onCountChange?: (n: number) => void;
}) {
  const [items, setItems] = useState<PromptExportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<PromptExportRecord | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

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
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
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
            <pre className="min-h-[35vh] flex-1 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
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
                items.map((rec) => (
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
                      <StatusBadge status={rec.status} />
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
