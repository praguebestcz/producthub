"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
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
}: {
  documentId: number;
  projectId: number;
  name: string;
  versions: Version[];
  isAuthor: boolean;
}) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [versionId, setVersionId] = useState<number>(versions[0]?.id ?? 0);
  const [viewSrc, setViewSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagePath, setPagePath] = useState<string>("");

  const currentVersion = versions.find((v) => v.id === versionId);

  // Přepnutí verze: zobraz spinner a přepni ID (fetch tokenu řeší efekt).
  function switchVersion(v: string | null) {
    if (!v) return;
    setLoading(true);
    setVersionId(Number(v));
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

  // Zpráva z overlay.js uvnitř iframe — na které stránce specifikace jsme.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (d && d.source === "producthub-overlay" && d.type === "ready") {
        setPagePath(typeof d.pagePath === "string" ? d.pagePath : "");
        setLoading(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
              trigger={
                <Button variant="outline" size="sm">
                  <Plus />
                  Nová verze
                </Button>
              }
              onDone={() => router.refresh()}
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
      </div>

      {/* Prohlížeč — sandboxovaný iframe (bez allow-same-origin = XSS ochrana) */}
      <div className="relative mt-4 h-[calc(100vh-16rem)] overflow-hidden rounded-xl border bg-white">
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
