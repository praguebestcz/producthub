"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CornerDownRight,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  MousePointer2,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MentionTextarea,
  activeMentions,
  type MentionMember,
} from "@/components/comments/mention-textarea";
import { cn } from "@/lib/utils";

// Postranní panel komentářových vláken — pravá část prohlížeče dokumentu.
// Viditelnost interních komentářů řeší SERVER (panel dostává už filtrovaná
// data); tady se jen kreslí a odesílá.

export type CommentUser = { id: number; name: string; avatarUrl?: string | null };

export type CommentReply = {
  id: number;
  body: string;
  visibility: "PUBLIC" | "INTERNAL";
  createdAt: string;
  author: CommentUser;
};

export type CommentThread = {
  id: number;
  documentVersionId: number;
  pagePath: string;
  body: string;
  visibility: "PUBLIC" | "INTERNAL";
  status: "OPEN" | "RESOLVED" | "REOPENED";
  dataReviewId: string | null;
  domPath: string | null;
  elementHtml: string | null;
  isOrphaned: boolean;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: { id: number; name: string } | null;
  author: CommentUser;
  replies: CommentReply[];
};

// Element vybraný v iframe (zpráva element.selected z overlay.js).
export type SelectedElement = {
  pagePath: string;
  dataReviewId: string | null;
  domPath: string;
  label: string | null;
  elementHtml: string;
  viewport: { width: number; height: number };
};

const STATUS_LABEL: Record<CommentThread["status"], string> = {
  OPEN: "Otevřený",
  RESOLVED: "Vyřešený",
  REOPENED: "Znovu otevřený",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Čitelný popis prvku odvozený z uloženého HTML výstřižku — tak, aby uživatele
// nezajímala technická DOM cesta („tlačítko „Odeslat dotaz""). Stejná logika
// jako v overlay.js (elementLabel), ale běží nad uloženým HTML.
const TAG_NAMES: Record<string, string> = {
  A: "odkaz",
  BUTTON: "tlačítko",
  INPUT: "pole",
  TEXTAREA: "pole",
  SELECT: "výběr",
  IMG: "obrázek",
  H1: "nadpis",
  H2: "nadpis",
  H3: "nadpis",
  H4: "nadpis",
  P: "odstavec",
  LI: "položka",
  TD: "buňka",
  TH: "buňka",
  LABEL: "popisek",
  SPAN: "text",
  DIV: "blok",
  SECTION: "sekce",
  NAV: "navigace",
  UL: "seznam",
  OL: "seznam",
  FORM: "formulář",
};

function deriveLabel(elementHtml: string | null): string | null {
  if (!elementHtml) return null;
  const tpl = document.createElement("template");
  tpl.innerHTML = elementHtml;
  const el = tpl.content.firstElementChild;
  if (!el) return null;
  const name = TAG_NAMES[el.tagName] ?? el.tagName.toLowerCase();
  let text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length > 40) text = text.slice(0, 40) + "…";
  return text ? `${name} „${text}"` : name;
}

export function CommentPanel({
  documentId,
  versionId,
  currentPagePath,
  threads,
  showAllPages,
  onShowAllPagesChange,
  activeThreadId,
  onActivateThread,
  selectedElement,
  onClearSelection,
  onChanged,
  canComment,
  canSeeInternal,
  members,
}: {
  documentId: number;
  versionId: number;
  currentPagePath: string;
  threads: CommentThread[];
  showAllPages: boolean;
  onShowAllPagesChange: (v: boolean) => void;
  activeThreadId: number | null;
  onActivateThread: (thread: CommentThread) => void;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
  onChanged: () => Promise<void>;
  canComment: boolean;
  canSeeInternal: boolean;
  members: MentionMember[];
}) {
  // Vlákna aktuální stránky určují číslování špendlíků (stejné pořadí jako pins).
  const pageThreads = threads.filter((t) => t.pagePath === currentPagePath);
  const visibleThreads = showAllPages ? threads : pageThreads;

  return (
    <aside className="flex w-96 shrink-0 flex-col rounded-xl border bg-background">
      {/* Hlavička panelu */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquare size={15} aria-hidden="true" />
          Komentáře ({visibleThreads.length})
        </span>
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Všechny stránky
          <Switch
            size="sm"
            checked={showAllPages}
            onCheckedChange={onShowAllPagesChange}
          />
        </Label>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* Formulář nového komentáře po výběru elementu v iframe */}
        {selectedElement && canComment && (
          <NewThreadForm
            documentId={documentId}
            versionId={versionId}
            selectedElement={selectedElement}
            onClearSelection={onClearSelection}
            onChanged={onChanged}
            canSeeInternal={canSeeInternal}
            members={members}
          />
        )}

        {visibleThreads.length === 0 && !selectedElement && (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            {canComment
              ? "Zatím žádné komentáře. Přepněte na režim komentování a klikněte na element ve specifikaci."
              : "Zatím žádné komentáře."}
          </p>
        )}

        {visibleThreads.map((thread) => (
          <ThreadCard
            key={thread.id}
            documentId={documentId}
            thread={thread}
            pinNumber={
              thread.pagePath === currentPagePath
                ? pageThreads.indexOf(thread) + 1
                : null
            }
            isActive={thread.id === activeThreadId}
            onActivate={() => onActivateThread(thread)}
            onChanged={onChanged}
            canComment={canComment}
            canSeeInternal={canSeeInternal}
            members={members}
          />
        ))}
      </div>
    </aside>
  );
}

// Info o prvku — čitelný popis místo technické DOM cesty (přání Hany).
// Syrový HTML je schovaný v <details> (běžně ho uživatel nepotřebuje, ale
// hodí se pro kontrolu a Claude prompt).
function ElementInfo({
  dataReviewId,
  label,
  elementHtml,
}: {
  dataReviewId: string | null;
  label: string | null;
  elementHtml: string | null;
}) {
  const shown = label ?? deriveLabel(elementHtml);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex size-4 items-center justify-center rounded bg-pb-soft text-pb">
          <MousePointer2 size={11} aria-hidden="true" />
        </span>
        {shown && <span className="text-xs font-medium">{shown}</span>}
        {dataReviewId && (
          <Badge variant="outline" className="max-w-full font-mono text-[11px]">
            <span className="truncate">{dataReviewId}</span>
          </Badge>
        )}
      </div>
      {elementHtml && (
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer select-none">Zobrazit HTML prvku</summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-2 whitespace-pre-wrap break-all">
            {elementHtml.length > 1_000
              ? elementHtml.slice(0, 1_000) + "…"
              : elementHtml}
          </pre>
        </details>
      )}
    </div>
  );
}

function AuthorLine({ author, createdAt }: { author: CommentUser; createdAt: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
        <AvatarFallback>{author.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">{author.name}</span>
      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
        {formatTime(createdAt)}
      </span>
    </div>
  );
}

function NewThreadForm({
  documentId,
  versionId,
  selectedElement,
  onClearSelection,
  onChanged,
  canSeeInternal,
  members,
}: {
  documentId: number;
  versionId: number;
  selectedElement: SelectedElement;
  onClearSelection: () => void;
  onChanged: () => Promise<void>;
  canSeeInternal: boolean;
  members: MentionMember[];
}) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [mentions, setMentions] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentVersionId: versionId,
          pagePath: selectedElement.pagePath,
          body,
          visibility: internal ? "INTERNAL" : "PUBLIC",
          mentions: activeMentions(body, mentions, members),
          dataReviewId: selectedElement.dataReviewId ?? undefined,
          domPath: selectedElement.domPath,
          elementHtml: selectedElement.elementHtml || undefined,
          viewportWidth: selectedElement.viewport.width || undefined,
          viewportHeight: selectedElement.viewport.height || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Komentář přidán.");
      onClearSelection();
      await onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Komentář se nepodařilo uložit.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-lg border border-pb/40 bg-pb-soft p-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin size={14} aria-hidden="true" />
          Nový komentář
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Zrušit výběr"
          onClick={onClearSelection}
        >
          <X />
        </Button>
      </div>
      <ElementInfo
        dataReviewId={selectedElement.dataReviewId}
        label={selectedElement.label}
        elementHtml={selectedElement.elementHtml}
      />
      <MentionTextarea
        value={body}
        onValueChange={setBody}
        mentions={mentions}
        onMentionsChange={setMentions}
        members={members}
        placeholder="Napište komentář… (@ zmíní člena)"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        {canSeeInternal ? (
          <Label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              checked={internal}
              onCheckedChange={(v) => setInternal(v === true)}
            />
            Interní
          </Label>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <MessageSquare />}
          Přidat komentář
        </Button>
      </div>
    </form>
  );
}

function ThreadCard({
  documentId,
  thread,
  pinNumber,
  isActive,
  onActivate,
  onChanged,
  canComment,
  canSeeInternal,
  members,
}: {
  documentId: number;
  thread: CommentThread;
  pinNumber: number | null;
  isActive: boolean;
  onActivate: () => void;
  onChanged: () => Promise<void>;
  canComment: boolean;
  canSeeInternal: boolean;
  members: MentionMember[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);

  // Klik na špendlík v iframe → vlákno se zvýrazní a naroluje do view.
  useEffect(() => {
    if (isActive) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  async function setStatus(status: "RESOLVED" | "REOPENED") {
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${thread.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(
        status === "RESOLVED" ? "Vlákno vyřešeno." : "Vlákno znovu otevřeno.",
      );
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Změna se nepovedla.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={cardRef}
      onClick={onActivate}
      className={cn(
        "cursor-pointer space-y-2 rounded-lg border p-2.5 transition-colors",
        isActive ? "border-pb ring-2 ring-pb/30" : "hover:border-foreground/25",
      )}
    >
      {/* Badge řádek: číslo špendlíku, stav, interní, cizí stránka, osiřelost */}
      <div className="flex flex-wrap items-center gap-1.5">
        {pinNumber !== null && (
          <span className="flex size-5 items-center justify-center rounded-full bg-pb text-[11px] font-bold text-white">
            {pinNumber}
          </span>
        )}
        <Badge
          variant={thread.status === "RESOLVED" ? "secondary" : "outline"}
          className="text-[11px]"
        >
          {STATUS_LABEL[thread.status]}
        </Badge>
        {thread.visibility === "INTERNAL" && (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <Lock size={10} aria-hidden="true" />
            Interní
          </Badge>
        )}
        {thread.pagePath && pinNumber === null && (
          <Badge variant="outline" className="max-w-36 font-mono text-[11px]">
            <span className="truncate">{thread.pagePath}</span>
          </Badge>
        )}
        {thread.isOrphaned && (
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            prvek už neexistuje
          </Badge>
        )}
      </div>

      <AuthorLine author={thread.author} createdAt={thread.createdAt} />
      <p className="text-sm whitespace-pre-wrap break-words">{thread.body}</p>
      <ElementInfo
        dataReviewId={thread.dataReviewId}
        label={deriveLabel(thread.elementHtml)}
        elementHtml={thread.elementHtml}
      />

      {/* Odpovědi */}
      {thread.replies.length > 0 && (
        <div className="space-y-2 border-l-2 pl-2.5">
          {thread.replies.map((reply) => (
            <div key={reply.id} className="space-y-1">
              <AuthorLine author={reply.author} createdAt={reply.createdAt} />
              {reply.visibility === "INTERNAL" && (
                <Badge variant="destructive" className="gap-1 text-[11px]">
                  <Lock size={10} aria-hidden="true" />
                  Interní
                </Badge>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">
                {reply.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {thread.status === "RESOLVED" && thread.resolvedBy && (
        <p className="text-[11px] text-muted-foreground">
          Vyřešil {thread.resolvedBy.name}
          {thread.resolvedAt ? ` · ${formatTime(thread.resolvedAt)}` : ""}
        </p>
      )}

      {/* Akce vlákna — COMMENTER+ */}
      {canComment && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReplying((v) => !v)}
          >
            <CornerDownRight />
            Odpovědět
          </Button>
          {thread.status === "RESOLVED" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setStatus("REOPENED")}
            >
              <RotateCcw />
              Znovu otevřít
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setStatus("RESOLVED")}
            >
              <Check />
              Vyřešit
            </Button>
          )}
        </div>
      )}

      {replying && canComment && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReplyForm
            documentId={documentId}
            thread={thread}
            onDone={async () => {
              setReplying(false);
              await onChanged();
            }}
            canSeeInternal={canSeeInternal}
            members={members}
          />
        </div>
      )}
    </div>
  );
}

function ReplyForm({
  documentId,
  thread,
  onDone,
  canSeeInternal,
  members,
}: {
  documentId: number;
  thread: CommentThread;
  onDone: () => Promise<void>;
  canSeeInternal: boolean;
  members: MentionMember[];
}) {
  // Odpověď v INTERNÍM vlákně je vždy interní (server ji stejně vynutí).
  const forcedInternal = thread.visibility === "INTERNAL";
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(forcedInternal);
  const [mentions, setMentions] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: thread.id,
          body,
          visibility: forcedInternal || internal ? "INTERNAL" : "PUBLIC",
          mentions: activeMentions(body, mentions, members),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Odpověď přidána.");
      await onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Odpověď se nepodařilo uložit.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <MentionTextarea
        value={body}
        onValueChange={setBody}
        mentions={mentions}
        onMentionsChange={setMentions}
        members={members}
        placeholder="Napište odpověď… (@ zmíní člena)"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        {canSeeInternal ? (
          <Label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              checked={forcedInternal || internal}
              disabled={forcedInternal}
              onCheckedChange={(v) => setInternal(v === true)}
            />
            Interní
            {forcedInternal && (
              <span className="text-muted-foreground">(interní vlákno)</span>
            )}
          </Label>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <CornerDownRight />}
          Odpovědět
        </Button>
      </div>
    </form>
  );
}
