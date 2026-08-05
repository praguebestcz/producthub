"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  CornerDownRight,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  MessageSquarePlus,
  MoreVertical,
  MousePointer2,
  Pencil,
  Pin,
  RotateCcw,
  SmilePlus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MentionTextarea,
  activeMentions,
  type MentionMember,
} from "@/components/comments/mention-textarea";
import { usePresenceTyping } from "@/components/presence/typing-context";
import { userColor } from "@/lib/presence/colors";
import { cn } from "@/lib/utils";
import { computeBubblePosition } from "@/lib/comments/bubble-position";
import {
  matchesStatusFilter,
  type StatusFilter,
} from "@/lib/comments/status";

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

export function deriveLabel(elementHtml: string | null): string | null {
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
// Filtr stavu žije v lib/comments/status.ts (sdílené + testovatelné);
// re-export, ať viewer může importovat z jednoho místa.
export { matchesStatusFilter, type StatusFilter };

// Pozice prvku v prohlížeči (viewportRect z overlay) — pro umístění bubliny.
export type BubblePosition = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
  // Bod kliknutí uvnitř prohlížeče — bublina se otevře u kurzoru. U starších
  // zpráv z overlaye chybí, pak se použije poloha prvku.
  point?: { x: number; y: number } | null;
};

// Postranní panel = sloupec vedle dokumentu (otevřením se dokument zúží, panel
// ho NEpřekrývá). Režim „thread" (jedno vlákno po kliku na špendlík) nebo
// „list" (seznam všech na tlačítko Komentáře). Zavřený má nulovou šířku —
// panel není pořád na očích (přání Hany).
export function CommentPanel({
  open,
  mode,
  onClose,
  documentId,
  versionId,
  currentPagePath,
  threads,
  statusFilter,
  onStatusFilterChange,
  activeThreadId,
  onActivateThread,
  onChanged,
  currentUserId,
  isAuthor,
  onRepin,
  canComment,
  canSeeInternal,
  isCommenting,
  onStartCommenting,
  canCreatePrompt,
  selectedIds,
  onToggleSelect,
  onSelectAllUnresolved,
  onClearSelection,
  onCreatePrompt,
  onCreatePromptForThread,
  generatingKey,
  members,
  typingByThread,
}: {
  open: boolean;
  mode: PanelMode;
  onClose: () => void;
  documentId: number;
  versionId: number;
  currentPagePath: string;
  threads: CommentThread[];
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  activeThreadId: number | null;
  onActivateThread: (thread: CommentThread) => void;
  onChanged: () => Promise<void>;
  currentUserId: number;
  // Autor projektu — smí znovu připnout i cizí komentář (M9 v1.1).
  isAuthor: boolean;
  // Spustí výběr nového prvku pro osiřelé vlákno. Chybí = připínat nelze
  // (starší verze jsou read-only).
  onRepin?: (threadId: number) => void;
  canComment: boolean;
  canSeeInternal: boolean;
  // Je zapnutý režim komentování? Řídí navádění v prázdném panelu.
  isCommenting: boolean;
  // Zapne režim komentování (tlačítko v prázdném panelu). Nepovinné.
  onStartCommenting?: () => void;
  // M8 — výběr komentářů pro tvorbu promptu (jen interní tým).
  canCreatePrompt: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onSelectAllUnresolved: (ids: number[]) => void;
  onClearSelection: () => void;
  onCreatePrompt: () => void;
  // Zkratka: vytvořit prompt z jednoho konkrétního vlákna.
  onCreatePromptForThread: (id: number) => void;
  // Co se právě generuje: "bulk" (výběr) / id vlákna / null.
  generatingKey: number | "bulk" | null;
  members: MentionMember[];
  // M7 Fáze 2 — kdo právě píše u kterého vlákna (threadId → jména).
  typingByThread: Map<number, string[]>;
}) {
  // Jen komentáře aktuální verze (u víceverzového dokumentu se verze nemíchají).
  const versionThreads = threads.filter(
    (t) => t.documentVersionId === versionId,
  );
  // Panel vždy ukazuje CELOU specifikaci (všechny stránky verze) — přání Hany,
  // komentuje se celá spec, ne jen část. Komentáře z jiných stránek mají v kartě
  // badge se stránkou; klik na ně přepne prohlížeč na tu stránku.
  const visibleThreads = versionThreads.filter((t) =>
    matchesStatusFilter(t.status, statusFilter),
  );
  // M8 — nevyřešená vlákna verze (napříč stránkami) jdou vybrat do promptu.
  const unresolvedVersionIds = versionThreads
    .filter((t) => t.status !== "RESOLVED")
    .map((t) => t.id);
  const selectedCount = selectedIds.size;
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
  // Má vlákno špendlík na právě zobrazené stránce? (Vlákno z jiné stránky ho
  // nemá — místo něj se ukáže odznak s cestou.) Číslo špendlíku se už nepoužívá:
  // špendlík v dokumentu nese avatar autora, číslo by nemělo k čemu odkazovat.
  function hasPinHere(thread: CommentThread): boolean {
    return thread.pagePath === currentPagePath;
  }

  return (
    // Panel je sloupec VEDLE dokumentu (ne překryv) — jinak by pravá část
    // specifikace i se svými špendlíky zmizela pod ním.
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-background transition-[width] duration-200",
        open ? "w-[26rem] max-w-[60%] border-l" : "pointer-events-none w-0 border-l-0",
      )}
      aria-hidden={!open}
      inert={!open}
    >
      {/* Obsah má PEVNOU šířku a je pozicovaný ABSOLUTNĚ uvnitř ořezávajícího
          rámu. Dva důvody:
          1. pevná šířka — zavřený panel má nulovou šířku a text by se jinak
             zalomil do pár pixelů širokého sloupce (karty by narostly do
             desítek tisíc pixelů);
          2. absolutní pozice — v běžném toku prosakovala výška obsahu až do
             stránky (ta pak měla vlastní posuvník do prázdna), přestože rám
             obsah vizuálně ořezal.
          Bonus: panel se takhle vysouvá, místo aby se obsah mačkal. */}
      <div className="absolute inset-y-0 right-0 flex w-[26rem] flex-col">
      {/* Hlavička panelu */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquare size={15} aria-hidden="true" />
          {mode === "thread"
            ? "Komentář"
            : `Komentáře (${visibleThreads.length})`}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Zavřít panel"
          onClick={onClose}
        >
          <X />
        </Button>
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

      {/* M8 — hromadný výběr nevyřešených pro tvorbu promptu (jen interní tým) */}
      {mode === "list" && canCreatePrompt && unresolvedVersionIds.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs">
          <button
            type="button"
            onClick={() => onSelectAllUnresolved(unresolvedVersionIds)}
            className="font-medium text-pb hover:underline"
          >
            Vybrat všechny nevyřešené
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              Zrušit výběr
            </button>
          )}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {mode === "thread" ? (
          activeThread ? (
            <ThreadCard
              documentId={documentId}
              thread={activeThread}
              hasPin={hasPinHere(activeThread)}
              isActive
              onActivate={() => onActivateThread(activeThread)}
              onChanged={onChanged}
              currentUserId={currentUserId}
              isAuthor={isAuthor}
              onRepin={onRepin}
              canComment={canComment}
              canSeeInternal={canSeeInternal}
              members={members}
              onCreatePrompt={
                canCreatePrompt
                  ? () => onCreatePromptForThread(activeThread.id)
                  : undefined
              }
              generatingPrompt={generatingKey === activeThread.id}
              generateDisabled={generatingKey !== null}
              typingNames={typingByThread.get(activeThread.id) ?? []}
            />
          ) : (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Vlákno nenalezeno.
            </p>
          )
        ) : (
          <>
            {visibleThreads.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MessageSquare size={20} aria-hidden="true" />
                </span>
                {statusFilter !== "open" ? (
                  // Prázdno kvůli filtru (ne kvůli chybějícím komentářům).
                  <p className="text-sm text-muted-foreground">
                    V tomto filtru nejsou žádné komentáře.
                  </p>
                ) : canComment ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Zatím tu žádné komentáře nejsou.
                    </p>
                    {isCommenting ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium text-pb">
                        <MousePointer2 size={15} aria-hidden="true" />
                        Klikněte na prvek ve specifikaci a napište k němu
                        komentář.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Přepněte na komentování a klikněte na prvek, který
                          chcete připomínkovat.
                        </p>
                        {onStartCommenting && (
                          <Button size="sm" onClick={onStartCommenting}>
                            <MessageSquarePlus />
                            Zapnout komentování
                          </Button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Zatím tu žádné komentáře nejsou.
                  </p>
                )}
              </div>
            )}
            {visibleThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                documentId={documentId}
                thread={thread}
                hasPin={hasPinHere(thread)}
                isActive={thread.id === activeThreadId}
                onActivate={() => onActivateThread(thread)}
                onChanged={onChanged}
                currentUserId={currentUserId}
                isAuthor={isAuthor}
                onRepin={onRepin}
                canComment={canComment}
                canSeeInternal={canSeeInternal}
                members={members}
                selectable={canCreatePrompt && thread.status !== "RESOLVED"}
                selected={selectedIds.has(thread.id)}
                onToggleSelect={() => onToggleSelect(thread.id)}
                onCreatePrompt={
                  canCreatePrompt
                    ? () => onCreatePromptForThread(thread.id)
                    : undefined
                }
                generatingPrompt={generatingKey === thread.id}
                generateDisabled={generatingKey !== null}
                typingNames={typingByThread.get(thread.id) ?? []}
              />
            ))}
          </>
        )}
      </div>

      {/* M8 — lišta výběru: počet vybraných + tvorba promptu (interní tým) */}
      {mode === "list" && canCreatePrompt && selectedCount > 0 && (
        <div className="flex items-center gap-2 border-t bg-background px-3 py-2.5">
          <span className="text-sm font-medium">Vybráno {selectedCount}</span>
          <Button
            size="sm"
            className="ml-auto"
            disabled={generatingKey !== null}
            onClick={onCreatePrompt}
          >
            {generatingKey === "bulk" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {generatingKey === "bulk" ? "Generuji…" : "Vytvořit prompt"}
          </Button>
        </div>
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
  const boxRef = useRef<HTMLDivElement>(null);
  // Skutečná výška formuláře, ne odhad — s odhadem se spodek s tlačítkem
  // „Odeslat" dostal pod okraj plochy a nešlo se k němu doscrollovat.
  // 200 je jen startovní hodnota pro první průchod, hned se přeměří.
  const [bubbleHeight, setBubbleHeight] = useState(200);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBubbleHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { left, top, maxHeight } = computeBubblePosition({
    point: position.point ?? null,
    rect: position,
    container,
    bubbleWidth: BUBBLE_W,
    bubbleHeight,
  });

  return (
    <div
      ref={boxRef}
      className="absolute z-30 overflow-y-auto"
      style={{ left, top, width: BUBBLE_W, maxHeight }}
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

// Jeden komentář nebo odpověď: řádek autora (avatar s barvou uživatele + jméno +
// čas + kebab menu ⋮ u vlastního) a tělo (nebo inline editor). Akce Upravit /
// Smazat jsou v kebab menu (vzor Google komentářů) - dřív to byly nenápadné
// textové odkazy, které šlo přehlédnout. Smazání potvrzuje dialog. Editovat/mazat
// smí jen VLASTNÍ a jen v nejnovější verzi (`canEdit`); server to hlídá znovu.
function CommentBlock({
  id,
  author,
  createdAt,
  body,
  isOwn,
  canEdit,
  onChanged,
  internal,
}: {
  id: number;
  author: CommentUser;
  createdAt: string;
  body: string;
  isOwn: boolean;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  internal?: boolean; // odpověď pod interním vláknem → badge Interní
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(body);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const color = userColor(author.id);

  async function save() {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Úprava se nepovedla.");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Komentář smazán.");
      setConfirmDel(false);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smazání se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // POZOR: žádný stopPropagation na celém bloku — klik kamkoli na text
    // komentáře či odpovědi musí probublat na dlaždici a přepnout vlákno
    // (zpětná vazba Hany). Zastavují se jen skutečně interaktivní části
    // (kebab menu, editační formulář).
    <div>
      <div className="flex items-center gap-2">
        <Avatar size="sm" style={{ boxShadow: `0 0 0 2px ${color}` }}>
          {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
          <AvatarFallback style={{ backgroundColor: color, color: "#fff" }}>
            {author.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-medium">{author.name}</span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
          {formatTime(createdAt)}
        </span>
        {canEdit && isOwn && !editing && (
          <span onClick={(e) => e.stopPropagation()} className="contents">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Možnosti komentáře"
                  className="-my-1 size-7 shrink-0 text-muted-foreground"
                />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem
                onClick={() => {
                  setValue(body);
                  setEditing(true);
                }}
              >
                <Pencil aria-hidden="true" />
                Upravit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 aria-hidden="true" />
                Smazat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </span>
        )}
      </div>

      {internal && (
        <Badge variant="destructive" className="mt-1 gap-1 text-[11px]">
          <Lock size={10} aria-hidden="true" />
          Interní
        </Badge>
      )}

      {editing ? (
        <div className="mt-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            maxLength={10_000}
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button size="sm" disabled={busy || !value.trim()} onClick={save}>
              Uložit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue(body);
              }}
            >
              Zrušit
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm whitespace-pre-wrap break-words">{body}</p>
      )}

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat komentář?</AlertDialogTitle>
            <AlertDialogDescription>
              Komentář se natrvalo odstraní. Tuto akci nelze vzít zpět. Vlákno,
              na které už někdo odpověděl, smazat nejde - jde upravit text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={del}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
}: {
  commentId: number;
  reactions: CommentReaction[];
  currentUserId: number;
  canComment: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Optimistický lokální stav (audit): reakce se projeví hned a NEstahuje se
  // celý strom komentářů po každém kliku. Když přijdou nové reakce z props
  // (po refetchi), převezmeme je — React idiom „úprava stavu při změně props
  // během renderu" (ne useEffect, react-hooks/set-state-in-effect).
  const [local, setLocal] = useState(reactions);
  const [prevReactions, setPrevReactions] = useState(reactions);
  if (prevReactions !== reactions) {
    setPrevReactions(reactions);
    setLocal(reactions);
  }

  // Agregace podle emoji: počet, jestli jsem reagoval já, jména reagujících.
  const grouped = new Map<
    string,
    { count: number; mine: boolean; names: string[] }
  >();
  for (const r of local) {
    const g = grouped.get(r.emoji) ?? { count: 0, mine: false, names: [] };
    g.count += 1;
    g.names.push(r.user.name);
    if (r.userId === currentUserId) g.mine = true;
    grouped.set(r.emoji, g);
  }

  async function toggle(emoji: string) {
    setPickerOpen(false);
    const mine = local.some(
      (r) => r.emoji === emoji && r.userId === currentUserId,
    );
    // Optimistický update — reakce se ukáže/zmizí okamžitě.
    const previous = local;
    setLocal(
      mine
        ? local.filter(
            (r) => !(r.emoji === emoji && r.userId === currentUserId),
          )
        : [...local, { emoji, userId: currentUserId, user: { name: "Vy" } }],
    );
    try {
      const res = await fetch(`/api/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    } catch (err) {
      setLocal(previous); // revert při chybě
      toast.error(err instanceof Error ? err.message : "Reakce se nezdařila.");
    }
  }

  if (grouped.size === 0 && !canComment) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {[...grouped.entries()].map(([emoji, g]) => (
        <button
          key={emoji}
          type="button"
          disabled={!canComment}
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
  const setTyping = usePresenceTyping();
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
        onTypingChange={(t) =>
          setTyping(t, {
            pagePath: selectedElement.pagePath,
            threadId: null,
            dataReviewId: selectedElement.dataReviewId,
            domPath: selectedElement.domPath,
          })
        }
      />
      {/* GDPR minimalizace: komentář je volný text a může jít i do AI. */}
      <p className="text-[10px] leading-tight text-muted-foreground">
        Nevkládejte zbytečně osobní údaje třetích osob.
      </p>
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
  hasPin,
  isActive,
  onActivate,
  onChanged,
  currentUserId,
  isAuthor = false,
  onRepin,
  canComment,
  canSeeInternal,
  members,
  selectable = false,
  selected = false,
  onToggleSelect,
  onCreatePrompt,
  generatingPrompt = false,
  generateDisabled = false,
  typingNames = [],
}: {
  documentId: number;
  thread: CommentThread;
  // Vlákno má špendlík na právě zobrazené stránce.
  hasPin: boolean;
  isActive: boolean;
  onActivate: () => void;
  onChanged: () => Promise<void>;
  currentUserId: number;
  // M9 v1.1 — znovu připnout smí autor projektu nebo autor komentáře.
  isAuthor?: boolean;
  onRepin?: (threadId: number) => void;
  canComment: boolean;
  canSeeInternal: boolean;
  members: MentionMember[];
  // M7 Fáze 2 — kdo právě píše v tomto vláknu (jména).
  typingNames?: string[];
  // M8 — zaškrtávátko pro výběr do promptu (jen u nevyřešených, interní tým).
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  // M8 — zkratka „Vytvořit prompt z tohoto komentáře" (interní tým).
  onCreatePrompt?: () => void;
  generatingPrompt?: boolean;
  generateDisabled?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);
  // Popis prvku parsuje HTML — memoizace, ať se to neděje při každém renderu
  // (audit): přepočítá se jen když se změní elementHtml.
  const elementLabel = useMemo(
    () => deriveLabel(thread.elementHtml),
    [thread.elementHtml],
  );

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
      {/* Badge řádek: výběr, číslo špendlíku, stav, interní, cizí stránka, osiřelost */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectable && (
          <span onClick={(e) => e.stopPropagation()} className="flex items-center">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.()}
              aria-label="Vybrat komentář do promptu"
            />
          </span>
        )}
        {/* Špendlík na této stránce. Dřív tu bylo pořadové číslo, ale špendlík
            v dokumentu nese avatar autora — číslo nemělo k čemu odkazovat. */}
        {hasPin && (
          <span
            title="Připnuto na této stránce"
            className="flex size-5 items-center justify-center rounded-full bg-pb-soft text-pb"
          >
            <MapPin size={12} aria-hidden="true" />
            <span className="sr-only">Připnuto na této stránce</span>
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
        {thread.pagePath && !hasPin && (
          <Badge variant="outline" className="max-w-36 font-mono text-[11px]">
            <span className="truncate">{thread.pagePath}</span>
          </Badge>
        )}
        {thread.isOrphaned && (
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            prvek už neexistuje
          </Badge>
        )}
        {/* M9 v1.1 — osiřelý komentář lze připnout k jinému prvku. Smí autor
            projektu (rovná kotvy po nahrání nové verze) nebo autor komentáře. */}
        {thread.isOrphaned &&
          onRepin &&
          (isAuthor || thread.author.id === currentUserId) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRepin(thread.id);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              <Pin size={11} aria-hidden="true" />
              Znovu připnout
            </button>
          )}
      </div>

      {typingNames.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span
            className="size-1.5 animate-pulse rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          {typingNames.length === 1
            ? `${typingNames[0].split(" ")[0]} píše…`
            : `${typingNames.length} lidí píše…`}
        </p>
      )}

      <CommentBlock
        id={thread.id}
        author={thread.author}
        createdAt={thread.createdAt}
        body={thread.body}
        isOwn={thread.author.id === currentUserId}
        canEdit={canComment}
        onChanged={onChanged}
      />
      <ElementInfo
        dataReviewId={thread.dataReviewId}
        label={elementLabel}
        elementHtml={thread.elementHtml}
      />
      <div onClick={(e) => e.stopPropagation()}>
        <ReactionBar
          commentId={thread.id}
          reactions={thread.reactions}
          currentUserId={currentUserId}
          canComment={canComment}
        />
      </div>

      {/* Odpovědi */}
      {thread.replies.length > 0 && (
        <div className="space-y-2 border-l-2 pl-2.5">
          {thread.replies.map((reply) => (
            <div key={reply.id} className="space-y-1">
              <CommentBlock
                id={reply.id}
                author={reply.author}
                createdAt={reply.createdAt}
                body={reply.body}
                isOwn={reply.author.id === currentUserId}
                canEdit={canComment}
                onChanged={onChanged}
                internal={reply.visibility === "INTERNAL"}
              />
              <div onClick={(e) => e.stopPropagation()}>
                <ReactionBar
                  commentId={reply.id}
                  reactions={reply.reactions}
                  currentUserId={currentUserId}
                  canComment={canComment}
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
          {/* Zkratka: prompt rovnou z tohoto komentáře (interní tým) */}
          {onCreatePrompt && (
            <Button
              variant="ghost"
              size="sm"
              disabled={generateDisabled}
              onClick={onCreatePrompt}
            >
              {generatingPrompt ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {generatingPrompt ? "Generuji…" : "Vytvořit prompt"}
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
  const setTyping = usePresenceTyping();
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
        onTypingChange={(t) =>
          setTyping(t, {
            pagePath: thread.pagePath,
            threadId: thread.id,
            dataReviewId: thread.dataReviewId,
            domPath: thread.domPath,
          })
        }
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
