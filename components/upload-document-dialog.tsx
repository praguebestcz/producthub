"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Link2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dialog pro nahrání dokumentu: import z URL (hlavní cesta) nebo soubor/ZIP.
// Používá se pro nový dokument (endpoint z `postUrl`) i novou verzi.
export function UploadDocumentDialog({
  postUrl,
  trigger,
  title = "Nový dokument",
  // U nové verze existujícího dokumentu se název nezadává (patří k dokumentu).
  showName = true,
  onDone,
}: {
  postUrl: string;
  trigger: React.ReactElement;
  title?: string;
  showName?: boolean;
  onDone?: (created: { documentId?: number; versionId: number }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(body: BodyInit, headers?: HeadersInit) {
    setBusy(true);
    try {
      const res = await fetch(postUrl, { method: "POST", body, headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Dokument nahrán.");
      setOpen(false);
      setUrl("");
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      if (onDone) onDone(data);
      else router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nahrání se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    send(JSON.stringify({ url, name: name || undefined }), {
      "Content-Type": "application/json",
    });
  }

  function submitFile(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Vyberte soubor.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    if (name) form.set("name", name);
    send(form);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Naimportujte nasazenou specifikaci z odkazu, nebo nahrajte soubor.
          </DialogDescription>
        </DialogHeader>

        {showName && (
          <div className="grid gap-1.5">
            <Label htmlFor="up-name">Název dokumentu (nepovinné)</Label>
            <Input
              id="up-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Frontend, Backend, Wireframy…"
              maxLength={200}
            />
          </div>
        )}

        <Tabs defaultValue="url" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">
              <Link2 className="mr-1.5 size-4" />
              Z odkazu
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <FileUp className="mr-1.5 size-4" />
              Soubor / ZIP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            <form onSubmit={submitUrl} className="grid gap-4 pt-2">
              <div className="grid gap-1.5">
                <Label htmlFor="up-url">Adresa specifikace</Label>
                <Input
                  id="up-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…vercel.app/"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Stáhne rozcestník i prolinkované stránky ze stejné domény
                  (do 30 stránek).
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy || !url.trim()}>
                  <Upload />
                  {busy ? "Importuji…" : "Importovat"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="file">
            <form onSubmit={submitFile} className="grid gap-4 pt-2">
              <div className="grid gap-1.5">
                <Label htmlFor="up-file">Soubor (.html nebo .zip)</Label>
                <Input
                  id="up-file"
                  type="file"
                  ref={fileRef}
                  accept=".html,.htm,.zip"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  ZIP může obsahovat víc stránek a assetů (CSS, obrázky, fonty).
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  <Upload />
                  {busy ? "Nahrávám…" : "Nahrát"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
