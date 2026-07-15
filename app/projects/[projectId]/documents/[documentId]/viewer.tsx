"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  MessageSquarePlus,
  MousePointer2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadDocumentDialog } from "@/components/upload-document-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CommentPanel,
  type CommentThread,
  type SelectedElement,
} from "@/components/comments/comment-panel";
import type { MentionMember } from "@/components/comments/mention-textarea";

type Version = {
  id: number;
  versionNumber: number;
  entryPath: string;
  source: "UPLOAD" | "URL";
  sourceUrl: string | null;
  createdAt: string;
};

export function DocumentViewer({
  documentId,
  projectId,
  name,
  versions,
  isAuthor,
  canComment,
  canSeeInternal,
  members,
}: {
  documentId: number;
  projectId: number;
  name: string;
  versions: Version[];
  isAuthor: boolean;
  canComment: boolean;
  canSeeInternal: boolean;
  members: MentionMember[];
}) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [versionId, setVersionId] = useState<number>(versions[0]?.id ?? 0);
  const [viewSrc, setViewSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagePath, setPagePath] = useState<string>("");

  // M6 — komentování:
  const [mode, setMode] = useState<"browse" | "comment">("browse");
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [showAllPages, setShowAllPages] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  // Refs pro handler zpráv (registruje se jednou, nesmí číst zastaralý stav).
  const pagePathRef = useRef("");
  const modeRef = useRef(mode);
  // Vlákno, které se má zvýraznit, až se donačte cílová stránka (klik na
  // komentář z JINÉ stránky → nejdřív navigace, pak highlight).
  const pendingHighlightRef = useRef<number | null>(null);

  const currentVersion = versions.find((v) => v.id === versionId);

  // Zpráva DO overlaye v iframe. targetOrigin "*" — iframe je opaque origin
  // (sandbox bez allow-same-origin), konkrétní origin nelze cílit.
  const postToOverlay = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "producthub-parent", ...msg },
      "*",
    );
  }, []);

  // Špendlíky = kořeny vláken AKTUÁLNÍ stránky (pořadí určuje číslování).
  const sendPins = useCallback(
    (threadList: CommentThread[], page: string) => {
      postToOverlay({
        type: "pins.update",
        pins: threadList
          .filter((t) => t.pagePath === page)
          .map((t) => ({
            commentId: t.id,
            dataReviewId: t.dataReviewId,
            domPath: t.domPath,
            status: t.status,
          })),
      });
    },
    [postToOverlay],
  );

  // Načte vlákna VŠECH stránek (panel filtruje lokálně) a srovná špendlíky.
  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThreads(data.threads);
      sendPins(data.threads, pagePathRef.current);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Komentáře se nepodařilo načíst.",
      );
    }
  }, [documentId, sendPins]);

  // Přepnutí verze: zobraz spinner a přepni ID (fetch tokenu řeší efekt).
  function switchVersion(v: string | null) {
    if (!v) return;
    setLoading(true);
    setSelectedElement(null);
    setActiveThreadId(null);
    setVersionId(Number(v));
  }

  // Navigace prohlížeče na jinou stránku specifikace (s čerstvým view-tokenem).
  async function goToPage(pagePath: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/versions/${versionId}/view-token`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const encoded = pagePath.split("/").map(encodeURIComponent).join("/");
      setViewSrc(`/view/${data.token}/${encoded}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Načtení se nepovedlo.");
      setLoading(false);
    }
  }

  // Přepnutí režimu — overlay dostane zprávu; návrat do procházení ruší výběr.
  function switchMode(next: "browse" | "comment") {
    setMode(next);
    modeRef.current = next;
    postToOverlay({ type: "mode", commenting: next === "comment" });
    if (next === "browse") setSelectedElement(null);
  }

  // Při změně verze vyžádá čerstvý view-token a nastaví iframe na vstupní
  // stránku. Fetch v async IIFE — setState až po `await` (pravidlo react-hooks).
  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/versions/${versionId}/view-token`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!cancelled) setViewSrc(`/view/${data.token}/${data.entryPath}`);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Načtení se nepovedlo.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  // Zprávy z overlay.js uvnitř iframe. NEJDŘÍV kontrola e.source — přijímáme
  // výhradně z NAŠEHO iframe (závazné z design docu; cizí okna by mohla zprávy
  // podvrhnout).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || d.source !== "producthub-overlay") return;

      if (d.type === "ready") {
        // Nová stránka uvnitř specifikace (i navigace prokliky) — overlay se
        // načetl znovu, pošli mu aktuální režim a špendlíky té stránky.
        const page = typeof d.pagePath === "string" ? d.pagePath : "";
        pagePathRef.current = page;
        setPagePath(page);
        setLoading(false);
        setSelectedElement(null);
        postToOverlay({
          type: "mode",
          commenting: modeRef.current === "comment",
        });
        void loadComments().then(() => {
          // Klik na vlákno z jiné stránky: po donačtení stránky (a špendlíků)
          // se element zvýrazní.
          if (pendingHighlightRef.current !== null) {
            postToOverlay({
              type: "highlight",
              commentId: pendingHighlightRef.current,
            });
            pendingHighlightRef.current = null;
          }
        });
      } else if (d.type === "element.selected") {
        setSelectedElement({
          pagePath: typeof d.pagePath === "string" ? d.pagePath : "",
          dataReviewId:
            typeof d.dataReviewId === "string" ? d.dataReviewId : null,
          domPath: typeof d.domPath === "string" ? d.domPath : "",
          elementHtml:
            typeof d.elementHtml === "string" ? d.elementHtml : "",
          viewport:
            d.viewport &&
            typeof d.viewport.width === "number" &&
            typeof d.viewport.height === "number"
              ? d.viewport
              : { width: 0, height: 0 },
        });
      } else if (d.type === "pin.clicked") {
        setActiveThreadId(Number(d.commentId));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadComments, postToOverlay]);

  // Zavření formuláře komentáře (uložení / zrušení / změna režimu) → overlay
  // zruší rámeček vybraného elementu a hover zase jezdí.
  useEffect(() => {
    if (selectedElement === null) {
      postToOverlay({ type: "selection.clear" });
    }
  }, [selectedElement, postToOverlay]);

  if (versions.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Dokument nemá žádnou verzi.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col">
      {/* Hlavička dokumentu: název + akce autora */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-pb-soft text-pb">
            <FileText size={18} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        </div>
        {isAuthor && (
          <div className="flex items-center gap-2">
            <RenameDocument
              documentId={documentId}
              currentName={name}
              onDone={() => router.refresh()}
            />
            <UploadDocumentDialog
              postUrl={`/api/documents/${documentId}/versions`}
              title="Nová verze"
              showName={false}
              successMessage="Nová verze nahrána."
              trigger={
                <Button variant="outline" size="sm">
                  <Plus />
                  Nová verze
                </Button>
              }
              onDone={(created) => {
                // Přepni prohlížeč na právě nahranou verzi (code review:
                // jinak zůstal na staré a vypadalo to, že se nic nestalo).
                setLoading(true);
                setVersionId(created.versionId);
                router.refresh();
              }}
            />
            <DeleteDocument
              documentId={documentId}
              projectId={projectId}
              name={name}
            />
          </div>
        )}
      </div>

      {/* Lišta: přepínač verzí + aktuální stránka */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Select
          value={String(versionId)}
          onValueChange={switchVersion}
          items={versions.map((v) => ({
            value: String(v.id),
            label: `Verze ${v.versionNumber}`,
          }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                Verze {v.versionNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentVersion && (
          <span className="text-xs text-muted-foreground">
            {currentVersion.source === "URL" && currentVersion.sourceUrl ? (
              <>importováno z {new URL(currentVersion.sourceUrl).hostname}</>
            ) : (
              <>nahraný soubor</>
            )}{" "}
            · {new Date(currentVersion.createdAt).toLocaleString("cs-CZ")}
          </span>
        )}

        {pagePath && (
          <Badge variant="outline" className="ml-auto font-mono">
            {pagePath}
          </Badge>
        )}

        {/* Režim prohlížeče — komentovat smí COMMENTER+ */}
        {canComment && (
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
            <Button
              variant={mode === "browse" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => switchMode("browse")}
              aria-pressed={mode === "browse"}
            >
              <MousePointer2 />
              Procházení
            </Button>
            <Button
              variant={mode === "comment" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => switchMode("comment")}
              aria-pressed={mode === "comment"}
            >
              <MessageSquarePlus />
              Komentování
            </Button>
          </div>
        )}
      </div>

      {/* Prohlížeč + panel komentářů */}
      <div className="mt-4 flex h-[calc(100vh-16rem)] gap-4">
        {/* Sandboxovaný iframe (bez allow-same-origin = XSS ochrana) */}
        <div className="relative flex-1 overflow-hidden rounded-xl border bg-white">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {viewSrc && (
            <iframe
              ref={iframeRef}
              src={viewSrc}
              title={name}
              className="h-full w-full"
              sandbox="allow-scripts allow-forms allow-popups"
              onLoad={() => setLoading(false)}
            />
          )}
        </div>

        <CommentPanel
          documentId={documentId}
          versionId={versionId}
          currentPagePath={pagePath}
          threads={threads}
          showAllPages={showAllPages}
          onShowAllPagesChange={setShowAllPages}
          activeThreadId={activeThreadId}
          onActivateThread={(thread) => {
            setActiveThreadId(thread.id);
            if (thread.pagePath === pagePathRef.current) {
              postToOverlay({ type: "highlight", commentId: thread.id });
            } else {
              // Vlákno z jiné stránky → prohlížeč na ni přejde a element
              // zvýrazní po načtení (pendingHighlightRef).
              pendingHighlightRef.current = thread.id;
              void goToPage(thread.pagePath);
            }
          }}
          selectedElement={selectedElement}
          onClearSelection={() => setSelectedElement(null)}
          onChanged={loadComments}
          canComment={canComment}
          canSeeInternal={canSeeInternal}
          members={members}
        />
      </div>
    </div>
  );
}

function RenameDocument({
  documentId,
  currentName,
  onDone,
}: {
  documentId: number;
  currentName: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Přejmenováno.");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Přejmenování se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Přejmenovat" />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Přejmenovat dokument</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 py-4">
            <Label htmlFor="rd-name">Název</Label>
            <Input
              id="rd-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              <Upload />
              {busy ? "Ukládám…" : "Uložit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDocument({
  documentId,
  projectId,
  name,
}: {
  documentId: number;
  projectId: number;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Dokument „${name}" byl smazán.`);
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smazání se nepovedlo.");
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Smazat dokument"
            className="text-destructive hover:text-destructive"
          />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Smazat dokument „{name}&ldquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Smažou se všechny verze i komentáře k tomuto dokumentu. Tato akce
            je nevratná.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={remove}>
            Smazat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
