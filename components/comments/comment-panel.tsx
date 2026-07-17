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
  SmilePlus,
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

// Reakce emoji na komentář — kdo a čím reagoval.
export type CommentReaction = {
  emoji: string;
  userId: number;
  user: { name: string };
};

export type CommentReply = {
  id: number;
  body: string;
  visibility: "PUBLIC" | "INTERNAL";
  createdAt: string;
  author: CommentUser;
  reactions: CommentReaction[];
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
  reactions: CommentReaction[];
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

export type PanelMode = "thread" | "list";
export type StatusFilter = "all" | "open" | "resolved";

// Odpovídá vlákno filtru stavu? „open" = nevyřešené (OPEN/REOPENED),
// „resolved" = jen vyřešené, „all" = vše. Sdílené panelem i špendlíky.
export function matchesStatusFilter(
  status: CommentThread["status"],
  filter: StatusFilter,
): boolean {
  if (filter === "open") return status !== "RESOLVED";
  if (filter === "resolved") return status === "RESOLVED";
  return true;
}

// Pozice prvku v prohlížeči (viewportRect z overlay) — pro umístění bubliny.
export type BubblePosition = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

// Postranní panel = vyjíždějící drawer. Režim „thread" (jedno vlákno po kliku
// na špendlík) nebo „list" (seznam všech na tlačítko Komentáře). Skrytý, dokud
// ho něco neotevře (přání Hany — panel není pořád na očích).
export function CommentPanel({
  open,
  mode,
  onClose,
  documentId,
  versionId,
  currentPagePath,
  threads,
  showAllPages,
  onShowAllPagesChange,
  statusFilter,
  onStatusFilterChange,
  activeThreadId,
  onActivateThread,
  onChanged,
  currentUserId,
  canComment,
  canSeeInternal,
  members,
}: {
  open: boolean;
  mode: PanelMode;
  onClose: () => void;
  documentId: number;
  versionId: number;
  currentPagePath: string;
  threads: CommentThread[];
  showAllPages: boolean;
  onShowAllPagesChange: (v: boolean) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  activeThreadId: number | null;
  onActivateThread: (thread: CommentThread) => void;
  onChanged: () => Promise<void>;
  currentUserId: number;
  canComment: boolean;
  canSeeInternal: boolean;
  members: MentionMember[];
}) {
  // Jen komentáře aktuální verze (u víceverzového dokumentu se verze nemíchají).
  const versionThreads = threads.filter(
    (t) => t.documentVersionId === versionId,
  );
  const pageThreads = versionThreads.filter(
    (t) => t.pagePath === currentPagePath,
  );
  const scopeThreads = showAllPages ? versionThreads : pageThreads;
  const visibleThreads = scopeThreads.filter((t) =>
    matchesStatusFilter(t.status, statusFilter),
  );
  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  // Esc zavře otevřený panel (konzistentní s bublinou).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Číslo špendlíku vlákna (dle pořadí na jeho stránce) — pro hlavičku karty.
  function pinNumberOf(thread: CommentThread): number | null {
    if (thread.pagePath !== currentPagePath) return null;
    return pageThreads.indexOf(thread) + 1;
  }

  return (
    <div
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex w-[26rem] max-w-[calc(100%-1rem)] flex-col border-l bg-background shadow-2xl transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      aria-hidden={!open}
      inert={!open}
    >
      {/* Hlavička draweru */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquare size={15} aria-hidden="true" />
          {mode === "thread"
            ? "Komentář"
            : `Komentáře (${visibleThreads.length})`}
        </span>
        <div className="flex items-center gap-2">
          {mode === "list" && (
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Všechny stránky
              <Switch
                size="sm"
                checked={showAllPages}
                onCheckedChange={onShowAllPagesChange}
              />
            </Label>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Zavřít panel"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>

      {/* Filtr stavu — jen v seznamu */}
      {mode === "list" && (
        <div className="flex items-center gap-1 border-b px-3 py-1.5">
          {(
            [
              ["open", "Nevyřešené"],
              ["resolved", "Vyřešené"],
              ["all", "Vše"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onStatusFilterChange(key)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                statusFilter === key
                  ? "bg-pb-soft text-pb"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {mode === "thread" ? (
          activeThread ? (
            <ThreadCard
              documentId={documentId}
              thread={activeThread}
              pinNumber={pinNumberOf(activeThread)}
              isActive
              onActivate={() => onActivateThread(activeThread)}
              onChanged={onChanged}
              currentUserId={currentUserId}
              canComment={canComment}
              canSeeInternal={canSeeInternal}
              members={members}
            />
          ) : (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Vlákno nenalezeno.
            </p>
          )
        ) : (
          <>
            {visibleThreads.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {canComment
                  ? "Zatím žádné komentáře. Zapněte režim Komentování a klikněte na prvek ve specifikaci."
                  : "Zatím žádné komentáře."}
              </p>
            )}
            {visibleThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                documentId={documentId}
                thread={thread}
                pinNumber={pinNumberOf(thread)}
                isActive={thread.id === activeThreadId}
                onActivate={() => onActivateThread(thread)}
                onChanged={onChanged}
                currentUserId={currentUserId}
                canComment={canComment}
                canSeeInternal={canSeeInternal}
                members={members}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Bublina nového komentáře přímo u prvku (styl Google Docs). Umístí se pod
// prvek podle jeho pozice v prohlížeči; hlídá okraje kontejneru. Po uložení
// zmizí a vzniká špendlík.
export function CommentBubble({
  documentId,
  versionId,
  selectedElement,
  position,
  container,
  onClose,
  onChanged,
  onCreated,
  canSeeInternal,
  members,
}: {
  documentId: number;
  versionId: number;
  selectedElement: SelectedElement;
  position: BubblePosition;
  container: { width: number; height: number };
  onClose: () => void;
  onChanged: () => Promise<void>;
  onCreated?: (commentId: number) => void;
  canSeeInternal: boolean;
  members: MentionMember[];
}) {
  const BUBBLE_W = 320;
  const BUBBLE_H = 200; // odhad výšky pro clamp do viditelné oblasti
  const MARGIN = 8;
  // Vodorovně: zarovnat s prvkem, ale nevylézt z kontejneru.
  let left = position.left;
  if (left + BUBBLE_W > container.width - MARGIN) {
    left = container.width - BUBBLE_W - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;
  // Svisle: pod prvek; když by se dole nevešlo, nad prvek.
  let top = position.bottom + MARGIN;
  if (top + BUBBLE_H > container.height && position.top - BUBBLE_H - MARGIN > 0) {
    top = position.top - BUBBLE_H - MARGIN;
  }
  // Clamp do viditelné oblasti — když prvek vyscrolluje k okraji, bublina
  // zůstane vidět (neodjede mimo, „nezmizí").
  top = Math.max(MARGIN, Math.min(top, container.height - BUBBLE_H));
  const style: React.CSSProperties = { left, top, width: BUBBLE_W };

  return (
    <div
      className="absolute z-30"
      style={style}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <NewThreadForm
        documentId={documentId}
        versionId={versionId}
        selectedElement={selectedElement}
        onClearSelection={onClose}
        onChanged={onChanged}
        onCreated={onCreated}
        canSeeInternal={canSeeInternal}
        members={members}
      />
    </div>
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

// Reakce emoji na komentář (styl Slack/Figma): existující reakce jako „chipy"
// (emoji + počet, zvýrazněné když jsem reagoval já), + tlačítko pro přidání.
// Klik = toggle (server rozhodne přidat/odebrat). Píše jen COMMENTER+.
const REACTION_CHOICES = ["👍", "✅", "👀", "❤️", "🎉", "🙏"];

function ReactionBar({
  commentId,
  reactions,
  currentUserId,
  canComment,
  onChanged,
}: {
  commentId: number;
  reactions: CommentReaction[];
  currentUserId: number;
  canComment: boolean;
  onChanged: () => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Agregace podle emoji: počet, jestli jsem reagoval já, jména reagujících.
  const grouped = new Map<
    string,
    { count: number; mine: boolean; names: string[] }
  >();
  for (const r of reactions) {
    const g = grouped.get(r.emoji) ?? { count: 0, mine: false, names: [] };
    g.count += 1;
    g.names.push(r.user.name);
    if (r.userId === currentUserId) g.mine = true;
    grouped.set(r.emoji, g);
  }

  async function toggle(emoji: string) {
    setPickerOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reakce se nezdařila.");
    } finally {
      setBusy(false);
    }
  }

  if (grouped.size === 0 && !canComment) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {[...grouped.entries()].map(([emoji, g]) => (
        <button
          key={emoji}
          type="button"
          disabled={busy || !canComment}
          onClick={() => toggle(emoji)}
          title={g.names.join(", ")}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
            g.mine
              ? "border-pb/40 bg-pb-soft text-pb"
              : "border-border hover:bg-muted",
            !canComment && "cursor-default",
          )}
        >
          <span>{emoji}</span>
          <span className="tabular-nums">{g.count}</span>
        </button>
      ))}

      {canComment && (
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Přidat reakci"
            className="flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <SmilePlus size={13} />
          </button>
          {pickerOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-lg border bg-popover p-1 shadow-md">
              {REACTION_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  className="rounded-md px-1 py-0.5 text-base hover:bg-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewThreadForm({
  documentId,
  versionId,
  selectedElement,
  onClearSelection,
  onChanged,
  onCreated,
  canSeeInternal,
  members,
}: {
  documentId: number;
  versionId: number;
  selectedElement: SelectedElement;
  onClearSelection: () => void;
  onChanged: () => Promise<void>;
  onCreated?: (commentId: number) => void;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Komentář přidán.");
      // Nejdřív načíst vlákna (ať je nové mezi nimi), pak otevřít panel na něj,
      // pak zavřít bublinu (pořadí kvůli tomu, že onClearSelection ruší bublinu).
      await onChanged();
      if (typeof data.id === "number") onCreated?.(data.id);
      onClearSelection();
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
      className="space-y-2 rounded-xl border-2 border-pb/40 bg-background p-2.5 shadow-2xl ring-1 ring-black/5"
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
  currentUserId,
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
  currentUserId: number;
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
      <div onClick={(e) => e.stopPropagation()}>
        <ReactionBar
          commentId={thread.id}
          reactions={thread.reactions}
          currentUserId={currentUserId}
          canComment={canComment}
          onChanged={onChanged}
        />
      </div>

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
              <div onClick={(e) => e.stopPropagation()}>
                <ReactionBar
                  commentId={reply.id}
                  reactions={reply.reactions}
                  currentUserId={currentUserId}
                  canComment={canComment}
                  onChanged={onChanged}
                />
              </div>
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
