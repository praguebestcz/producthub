"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  Home,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MousePointer2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  CommentBubble,
  CommentPanel,
  matchesStatusFilter,
  type BubblePosition,
  type CommentThread,
  type PanelMode,
  type SelectedElement,
  type StatusFilter,
} from "@/components/comments/comment-panel";
import {
  CreatePromptDialog,
  PromptExportsDialog,
} from "@/components/comments/prompt-export";
import type { MentionMember } from "@/components/comments/mention-textarea";
import { usePresence, type PresenceUser } from "@/components/presence/use-presence";
import { PresenceBar } from "@/components/presence/presence-bar";
import { userColor } from "@/lib/presence/colors";
import { PresenceTypingProvider } from "@/components/presence/typing-context";
import { cn } from "@/lib/utils";

type Version = {
  id: number;
  versionNumber: number;
  entryPath: string;
  source: "UPLOAD" | "URL";
  sourceUrl: string | null;
  createdAt: string;
};

// Bezpečně převede viewportRect z overlaye na pozici bubliny (obrana proti
// chybějícím/nečíselným hodnotám z postMessage).
function normalizeRect(r: unknown): BubblePosition {
  const o = (r ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    top: num(o.top),
    left: num(o.left),
    width: num(o.width),
    height: num(o.height),
    bottom: num(o.bottom),
    right: num(o.right),
  };
}

export function DocumentViewer({
  documentId,
  projectId,
  name,
  versions,
  isAuthor,
  currentUserId,
  canComment,
  canSeeInternal,
  canCreatePrompt,
  members,
}: {
  documentId: number;
  projectId: number;
  name: string;
  versions: Version[];
  isAuthor: boolean;
  currentUserId: number;
  canComment: boolean;
  canSeeInternal: boolean;
  canCreatePrompt: boolean;
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
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  // Bublina nového komentáře u prvku (styl Google Docs).
  const [bubble, setBubble] = useState<{
    element: SelectedElement;
    position: BubblePosition;
  } | null>(null);
  // Panel je vyjíždějící drawer — skrytý, dokud ho něco neotevře.
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("list");
  // Filtr stavu — výchozí „nevyřešené" (vyřešené se běžně nezobrazují, ani
  // špendlíky na stránce; přání Hany). Filtr platí pro panel i špendlíky.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  // M8 — výběr komentářů pro prompt (jen interní tým), rozpracované zadání,
  // okno „Předaná zadání" a jejich počet (odznak na tlačítku).
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [promptDraft, setPromptDraft] = useState<{
    title: string;
    body: string;
    commentIds: number[];
  } | null>(null);
  const [exportsOpen, setExportsOpen] = useState(false);
  const [exportCount, setExportCount] = useState(0);
  // Co se právě generuje přes AI: "bulk" (výběr), id konkrétního vlákna, nebo
  // nic. Řídí spinner na správném tlačítku a zamkne ostatní během generování.
  const [generatingKey, setGeneratingKey] = useState<number | "bulk" | null>(
    null,
  );
  // Kontejner prohlížeče (pro umístění bubliny podle pozice prvku).
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDims, setContainerDims] = useState({ width: 0, height: 0 });
  // Drobečková navigace: cesta stránkami specifikace, jak jimi uživatel prošel.
  const [pageTrail, setPageTrail] = useState<string[]>([]);
  // Refs pro handler zpráv (registruje se jednou, nesmí číst zastaralý stav).
  const pagePathRef = useRef("");
  const modeRef = useRef(mode);
  const threadsRef = useRef<CommentThread[]>([]);
  // Vlákno, které se má zvýraznit, až se donačte cílová stránka (klik na
  // komentář z JINÉ stránky → nejdřív navigace, pak highlight).
  const pendingHighlightRef = useRef<number | null>(null);
  // Proklik ze zvonečku: cílové vlákno z URL (?comment=<rootId>). Otevře se
  // jednorázově, jakmile se vlákna donačtou.
  const wantCommentRef = useRef<number | null>(null);
  const highlightFromUrlDoneRef = useRef(false);
  // Skok „kde píše" na prvek z jiné stránky → zvýraznit po jejím načtení.
  const pendingHighlightAnchorRef = useRef<{
    dataReviewId: string | null;
    domPath: string | null;
  } | null>(null);
  // Aktivní view-token + kdy vznikl. Reuse napříč navigacemi téže verze, ať se
  // URL assetů nemění a prohlížeč je cacheuje (výkon, audit). Po ~50 min se
  // vydá nový (token má TTL ~1 h).
  const viewTokenRef = useRef<{ token: string; versionId: number; at: number } | null>(
    null,
  );

  const currentVersion = versions.find((v) => v.id === versionId);
  const entryPath = currentVersion?.entryPath ?? "index.html";
  // Read-only starší verze (M9): komentovat/měnit stav lze jen v NEJNOVĚJŠÍ verzi.
  const latestVersion = versions.length
    ? versions.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a))
    : undefined;
  const isReadOnlyVersion = !!latestVersion && versionId !== latestVersion.id;
  const canCommentNow = canComment && !isReadOnlyVersion;

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
          // Špendlíky: jen aktuální verze (jinak by se u víceverzového dokumentu
          // připínaly komentáře z jiných verzí na špatné prvky), aktuální stránka
          // a dle filtru stavu (vyřešené se defaultně neukazují).
          .filter(
            (t) =>
              t.documentVersionId === versionId &&
              t.pagePath === page &&
              matchesStatusFilter(t.status, statusFilter),
          )
          .map((t) => ({
            commentId: t.id,
            dataReviewId: t.dataReviewId,
            domPath: t.domPath,
            status: t.status,
            // Náhled na najetí myší (Figma pattern) — autor + začátek textu.
            preview: `${t.author.name}: ${t.body.slice(0, 80)}`,
            // Avatar autora ve špendlíku (Figma pattern) — kdo komentář napsal.
            authorName: t.author.name,
            avatarUrl: t.author.avatarUrl ?? null,
          })),
      });
    },
    [postToOverlay, statusFilter, versionId],
  );

  // Změna filtru stavu / verze → přepočítat špendlíky na stránce.
  useEffect(() => {
    sendPins(threadsRef.current, pagePathRef.current);
  }, [statusFilter, versionId, sendPins]);

  // Načte vlákna VŠECH stránek (panel filtruje lokálně) a srovná špendlíky.
  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThreads(data.threads);
      threadsRef.current = data.threads;
      sendPins(data.threads, pagePathRef.current);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Komentáře se nepodařilo načíst.",
      );
    }
  }, [documentId, sendPins]);

  // Přítomnost u dokumentu (M7 Fáze 2) — kdo je tu + „píše (kde)" + živé doručení
  // komentářů: když někdo jiný přidá/změní komentář, přenačteme (loadComments).
  const { users: presentUsers, setTyping } = usePresence(
    documentId,
    loadComments,
  );

  // Kotva komentáře = (dataReviewId, jinak domPath). Slouží k rozpoznání
  // „stejného prvku" — jeden prvek má jen jedno vlákno (další jako odpovědi).
  function threadAnchor(t: {
    dataReviewId: string | null;
    domPath: string | null;
  }): string {
    return t.dataReviewId ? "id:" + t.dataReviewId : "dom:" + (t.domPath ?? "");
  }


  // Přepnutí verze: zobraz spinner a přepni ID (fetch tokenu řeší efekt).
  function switchVersion(v: string | null) {
    if (!v) return;
    setLoading(true);
    setBubble(null);
    setActiveThreadId(null);
    setPanelOpen(false);
    setSelectedIds(new Set()); // výběr pro prompt platí v rámci verze
    // Přepnutí verze resetuje na procházení (starší verze jsou read-only).
    setMode("browse");
    modeRef.current = "browse";
    setVersionId(Number(v));
  }

  // M8 — výběr komentářů do promptu.
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Vygeneruje přes AI (server → Claude) prompt se ZMĚNAMI z daných vláken a
  // otevře okno pro kontrolu/uložení. Generování běží na serveru — komentáře
  // se berou z DB (autoritativně, s filtrem viditelnosti), ne z klienta.
  // `key` = "bulk" (z výběru) nebo id vlákna (zkratka u konkrétního komentáře).
  async function generatePromptFor(commentIds: number[], key: number | "bulk") {
    if (commentIds.length === 0) return;
    setGeneratingKey(key);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/prompt-exports/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentVersionId: versionId,
            commentIds,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const dateStr = new Date().toLocaleDateString("cs-CZ");
      setPromptDraft({
        title: `Úpravy z ${commentIds.length} ${
          commentIds.length === 1 ? "připomínky" : "připomínek"
        } · ${dateStr}`,
        body: data.body,
        commentIds,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generování se nezdařilo.");
    } finally {
      setGeneratingKey(null);
    }
  }

  // Prompt z výběru (hromadná lišta).
  function openPromptDraft() {
    const ids = threads
      .filter(
        (t) =>
          selectedIds.has(t.id) &&
          t.documentVersionId === versionId &&
          t.status !== "RESOLVED",
      )
      .map((t) => t.id);
    void generatePromptFor(ids, "bulk");
  }

  // Vrátí platný view-token pro aktuální verzi — reuse dokud je čerstvý (< 50
  // min), jinak vyžádá nový. Reuse ustálí URL assetů → cache je netahá z DB.
  const TOKEN_REUSE_MS = 50 * 60 * 1000;
  async function ensureViewToken(): Promise<string> {
    const cached = viewTokenRef.current;
    if (
      cached &&
      cached.versionId === versionId &&
      Date.now() - cached.at < TOKEN_REUSE_MS
    ) {
      return cached.token;
    }
    const res = await fetch(`/api/versions/${versionId}/view-token`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    viewTokenRef.current = { token: data.token, versionId, at: Date.now() };
    return data.token;
  }

  // Navigace prohlížeče na jinou stránku specifikace (reuse tokenu).
  async function goToPage(pagePath: string) {
    setLoading(true);
    try {
      const token = await ensureViewToken();
      const encoded = pagePath.split("/").map(encodeURIComponent).join("/");
      setViewSrc(`/view/${token}/${encoded}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Načtení se nepovedlo.");
      setLoading(false);
    }
  }

  // Přepnutí režimu — overlay dostane zprávu; návrat do procházení ruší bublinu.
  function switchMode(next: "browse" | "comment") {
    setMode(next);
    modeRef.current = next;
    postToOverlay({ type: "mode", commenting: next === "comment" });
    if (next === "browse") setBubble(null);
  }

  // Klik na avatar píšícího (lišta přítomných) → skoč na prvek, kde právě píše
  // (i přes stránky). U odpovědi zároveň otevře jeho vlákno v panelu.
  function jumpToTyping(user: PresenceUser) {
    const loc = user.typing;
    if (!loc) return;
    if (loc.threadId != null) {
      setActiveThreadId(loc.threadId);
      setPanelMode("thread");
      setPanelOpen(true);
    }
    if (loc.pagePath === pagePathRef.current) {
      postToOverlay({
        type: "highlight.anchor",
        dataReviewId: loc.dataReviewId,
        domPath: loc.domPath,
      });
    } else {
      pendingHighlightAnchorRef.current = {
        dataReviewId: loc.dataReviewId,
        domPath: loc.domPath,
      };
      void goToPage(loc.pagePath);
    }
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
        if (!cancelled) {
          viewTokenRef.current = { token: data.token, versionId, at: Date.now() };
          setViewSrc(`/view/${data.token}/${data.entryPath}`);
        }
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
        setBubble(null);
        // Drobečková cesta: stránka už v cestě → ořízni k ní (návrat zpět),
        // jinak přidej na konec.
        setPageTrail((trail) => {
          if (trail[trail.length - 1] === page) return trail;
          const idx = trail.indexOf(page);
          if (idx >= 0) return trail.slice(0, idx + 1);
          return [...trail, page];
        });
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
          // Skok „kde píše" na prvek z jiné stránky.
          if (pendingHighlightAnchorRef.current !== null) {
            postToOverlay({
              type: "highlight.anchor",
              ...pendingHighlightAnchorRef.current,
            });
            pendingHighlightAnchorRef.current = null;
          }
        });
      } else if (d.type === "element.selected") {
        const dataReviewId =
          typeof d.dataReviewId === "string" ? d.dataReviewId : null;
        const domPath = typeof d.domPath === "string" ? d.domPath : "";
        const page = typeof d.pagePath === "string" ? d.pagePath : "";
        // Jeden prvek = jedno vlákno: pokud na stejném prvku vlákno existuje,
        // NEotvírej bublinu, otevři jeho vlákno v panelu (další = odpovědi).
        const anchor = threadAnchor({ dataReviewId, domPath });
        const existing = threadsRef.current.find(
          (t) => t.pagePath === page && threadAnchor(t) === anchor,
        );
        if (existing) {
          setBubble(null);
          setActiveThreadId(existing.id);
          setPanelMode("thread");
          setPanelOpen(true);
          postToOverlay({ type: "highlight", commentId: existing.id });
          toast.info("K tomuto prvku už komentář je — přidejte odpověď.");
          return;
        }
        // Nový prvek → bublina komentáře u prvku.
        setBubble({
          element: {
            pagePath: page,
            dataReviewId,
            domPath,
            label: typeof d.label === "string" ? d.label : null,
            elementHtml: typeof d.elementHtml === "string" ? d.elementHtml : "",
            viewport:
              d.viewport &&
              typeof d.viewport.width === "number" &&
              typeof d.viewport.height === "number"
                ? d.viewport
                : { width: 0, height: 0 },
          },
          position: normalizeRect(d.viewportRect),
        });
      } else if (d.type === "anchor.moved") {
        // Prvek se posunul (scroll) → drž bublinu u něj.
        setBubble((b) =>
          b ? { ...b, position: normalizeRect(d.viewportRect) } : b,
        );
      } else if (d.type === "background.clicked") {
        // Klik do prázdna ve specifikaci → zavři bublinu.
        setBubble(null);
      } else if (d.type === "pin.clicked") {
        setActiveThreadId(Number(d.commentId));
        setPanelMode("thread");
        setPanelOpen(true);
      } else if (d.type === "highlight.result") {
        // Prvek se na stránce nenašel (dynamický modal / skrytý) → hláška.
        if (d.found === false) {
          toast.info(
            "Prvek se objeví až po otevření příslušného okna. V panelu je jeho náhled.",
          );
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadComments, postToOverlay]);

  // Zavření bubliny (uložení / zrušení / změna režimu) → overlay zruší
  // rámeček vybraného prvku a hover zase jezdí.
  useEffect(() => {
    if (bubble === null) {
      postToOverlay({ type: "selection.clear" });
    }
  }, [bubble, postToOverlay]);

  // Rozměry kontejneru prohlížeče (pro umístění bubliny u prvku) — sleduje
  // ResizeObserver, ať bublina počítá pozici proti aktuální velikosti.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setContainerDims({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Proklik ze zvonečku — přečti ?comment=<rootId> z URL (jednou, na klientu).
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("comment");
    const id = raw ? Number(raw) : NaN;
    if (Number.isInteger(id) && id > 0) wantCommentRef.current = id;
  }, []);

  // Když jsou vlákna načtená a přišli jsme s ?comment=<rootId>, otevři panel na
  // daném vláknu a zvýrazni ho (na jiné stránce nejdřív naviguj). Jednorázově.
  useEffect(() => {
    if (highlightFromUrlDoneRef.current || wantCommentRef.current === null) {
      return;
    }
    const thread = threads.find((t) => t.id === wantCommentRef.current);
    if (!thread) return;
    highlightFromUrlDoneRef.current = true;
    setActiveThreadId(thread.id);
    setPanelMode("thread");
    setPanelOpen(true);
    if (thread.pagePath === pagePathRef.current) {
      postToOverlay({ type: "highlight", commentId: thread.id });
    } else {
      pendingHighlightRef.current = thread.id;
      void goToPage(thread.pagePath);
    }
    // goToPage není memoizovaná; efekt běží jednorázově (guard ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads]);

  // M8 — počet uložených zadání (odznak na tlačítku „Zadání"). Jen interní tým.
  useEffect(() => {
    if (!canCreatePrompt) return;
    let cancelled = false;
    fetch(`/api/documents/${documentId}/prompt-exports`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.exports)) {
          setExportCount(d.exports.length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canCreatePrompt, documentId]);

  // Živé značky „píše" na AKTUÁLNÍ stránce → overlay: u prvku se ukáže AVATAR
  // píšícího (barva per uživatel). Víc lidí u STEJNÉHO prvku = shluk avatarů
  // v jedné značce (jinak by se překrývaly na stejné pozici).
  useEffect(() => {
    type MUser = {
      name: string;
      initial: string;
      avatarUrl: string | null;
      color: string;
    };
    const byAnchor = new Map<
      string,
      { dataReviewId: string | null; domPath: string | null; users: MUser[] }
    >();
    for (const u of presentUsers) {
      const t = u.typing;
      if (!t || t.pagePath !== pagePath) continue;
      const key = t.dataReviewId ? "id:" + t.dataReviewId : "dom:" + (t.domPath ?? "");
      const entry: MUser = {
        name: u.name,
        initial: u.name.slice(0, 1).toUpperCase(),
        avatarUrl: u.avatarUrl,
        color: userColor(u.userId),
      };
      const cur = byAnchor.get(key);
      if (cur) cur.users.push(entry);
      else
        byAnchor.set(key, {
          dataReviewId: t.dataReviewId,
          domPath: t.domPath,
          users: [entry],
        });
    }
    postToOverlay({ type: "presence.markers", markers: [...byAnchor.values()] });
  }, [presentUsers, pagePath, postToOverlay]);

  // „Kdo píše u kterého vlákna" (pro panel) — threadId → jména.
  const typingByThread = new Map<number, string[]>();
  for (const u of presentUsers) {
    const tid = u.typing?.threadId;
    if (tid != null) {
      typingByThread.set(tid, [...(typingByThread.get(tid) ?? []), u.name]);
    }
  }

  if (versions.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Dokument nemá žádnou verzi.
      </div>
    );
  }

  return (
    <PresenceTypingProvider value={setTyping}>
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
              showTransfer={true}
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

      {/* Lišta: přepínač verzí + info + režim + tlačítko Komentáře */}
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

        {/* Kdo je právě u dokumentu + kdo píše (M7 Fáze 2) */}
        <PresenceBar users={presentUsers} onJump={jumpToTyping} />

        {/* Režim prohlížeče — komentovat smí COMMENTER+. Výrazný přepínač:
            aktivní „Komentování" svítí PB červenou. */}
        {canCommentNow && (
          <div className="ml-auto flex items-center gap-1.5 rounded-xl border-2 border-pb/25 bg-pb-soft p-1">
            <span className="pl-1.5 text-xs font-semibold text-pb">Režim:</span>
            <button
              type="button"
              onClick={() => switchMode("browse")}
              aria-pressed={mode === "browse"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "browse"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-white/60 hover:text-foreground",
              )}
            >
              <MousePointer2 size={16} />
              Procházení
            </button>
            <button
              type="button"
              onClick={() => switchMode("comment")}
              aria-pressed={mode === "comment"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "comment"
                  ? "bg-pb text-white shadow-sm"
                  : "text-pb hover:bg-white/60",
              )}
            >
              <MessageSquarePlus size={16} />
              Komentování
            </button>
          </div>
        )}

        {/* Tlačítko otevře přehled všech komentářů (drawer, režim seznam) */}
        <Button
          variant={panelOpen && panelMode === "list" ? "secondary" : "outline"}
          size="sm"
          className={canCommentNow ? "" : "ml-auto"}
          onClick={() => {
            if (panelOpen && panelMode === "list") {
              setPanelOpen(false);
            } else {
              setPanelMode("list");
              setPanelOpen(true);
            }
          }}
        >
          <MessageSquare />
          {/* Nevyřešené komentáře CELÉ verze (panel ukazuje celou specifikaci,
              ne jen aktuální stránku) — počet tlačítka i panelu tak sedí. */}
          Komentáře (
          {
            threads.filter(
              (t) =>
                t.documentVersionId === versionId && t.status !== "RESOLVED",
            ).length
          }
          )
        </Button>

        {/* Předaná zadání (M8) — jen interní tým */}
        {canCreatePrompt && (
          <Button
            variant={exportsOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setExportsOpen(true)}
          >
            <ClipboardList />
            Zadání{exportCount > 0 ? ` (${exportCount})` : ""}
          </Button>
        )}
      </div>

      {/* Drobečková navigace mezi stránkami specifikace — nad dokumentem */}
      {pagePath && (
        <nav className="mt-3 flex items-center gap-1 rounded-lg border bg-muted/40 px-2 py-1.5 text-xs">
          {/* Šipka Zpět jen když je kam — na rozcestníku (první stránka) se
              nezobrazuje (zpětná vazba Hany). */}
          {pageTrail.length >= 2 && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Zpět"
              onClick={() => {
                const prev = pageTrail[pageTrail.length - 2];
                if (prev) goToPage(prev);
              }}
            >
              <ChevronLeft />
            </Button>
          )}
          {pageTrail.map((p, i) => {
            const isLast = i === pageTrail.length - 1;
            const label = p === entryPath ? "Rozcestník" : p;
            return (
              <span key={p} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    size={12}
                    className="text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                {isLast ? (
                  <span className="flex items-center gap-1 font-medium">
                    {p === entryPath && <Home size={12} aria-hidden="true" />}
                    {label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => goToPage(p)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {p === entryPath && <Home size={12} aria-hidden="true" />}
                    {label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {/* Banner režimu — na první pohled jasné, v jakém režimu uživatel je
          (zpětná vazba Hany). Komentování = červený (pozor, kliky vybírají),
          Procházení = neutrální tmavý (kliky fungují normálně). */}
      {isReadOnlyVersion && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 shadow-sm">
          <History size={16} aria-hidden="true" />
          <span>
            Prohlížíte starší verzi - jen ke čtení. Komentovat a odpovídat lze
            jen v nejnovější verzi dokumentu.
          </span>
        </div>
      )}
      {canCommentNow &&
        (mode === "comment" ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-pb px-3 py-2 text-sm font-medium text-white shadow-sm">
            <MessageSquarePlus size={16} aria-hidden="true" />
            <span>
              Režim komentování - klikněte na prvek ve specifikaci a napište k
              němu komentář.
            </span>
            <button
              type="button"
              onClick={() => switchMode("browse")}
              className="ml-auto rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
            >
              Ukončit komentování
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm">
            <MousePointer2 size={16} aria-hidden="true" />
            <span>
              Režim procházení - kliky fungují normálně (odkazy, tlačítka,
              modaly). Pro komentování přepněte režim.
            </span>
            <button
              type="button"
              onClick={() => switchMode("comment")}
              className="ml-auto rounded-md bg-background/20 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-background/30"
            >
              Přejít na komentování
            </button>
          </div>
        ))}

      {/* Prohlížeč přes celou šířku; bublina a panel jsou překryvné vrstvy */}
      <div
        ref={containerRef}
        className={cn(
          "relative mt-3 overflow-hidden rounded-xl border bg-white transition-all",
          // Banner (u kohokoli, kdo smí komentovat) ubere kus výšky.
          // Červený rámeček navíc jen v režimu komentování (pozor, vybíráš prvky).
          canComment ? "h-[calc(100vh-20rem)]" : "h-[calc(100vh-17rem)]",
          canCommentNow && mode === "comment" && "ring-2 ring-pb/40",
        )}
      >
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

        {/* Bublina nového komentáře u prvku */}
        {bubble && canCommentNow && (
          <CommentBubble
            documentId={documentId}
            versionId={versionId}
            selectedElement={bubble.element}
            position={bubble.position}
            container={containerDims}
            onClose={() => setBubble(null)}
            onChanged={loadComments}
            onCreated={(commentId) => {
              // Po uložení komentáře z bubliny automaticky otevři panel s ním
              // (zpětná vazba Hany — ať je hned vidět, že komentář vznikl).
              setActiveThreadId(commentId);
              setPanelMode("thread");
              setPanelOpen(true);
              postToOverlay({ type: "highlight", commentId });
            }}
            canSeeInternal={canSeeInternal}
            members={members}
          />
        )}

        {/* Vyjíždějící panel s diskusí / seznamem */}
        <CommentPanel
          open={panelOpen}
          mode={panelMode}
          onClose={() => setPanelOpen(false)}
          documentId={documentId}
          versionId={versionId}
          currentPagePath={pagePath}
          threads={threads}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
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
          onChanged={loadComments}
          currentUserId={currentUserId}
          canComment={canCommentNow}
          canSeeInternal={canSeeInternal}
          isCommenting={mode === "comment"}
          onStartCommenting={() => switchMode("comment")}
          canCreatePrompt={canCreatePrompt}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAllUnresolved={(ids) => setSelectedIds(new Set(ids))}
          onClearSelection={() => setSelectedIds(new Set())}
          onCreatePrompt={openPromptDraft}
          onCreatePromptForThread={(id) => generatePromptFor([id], id)}
          generatingKey={generatingKey}
          members={members}
          typingByThread={typingByThread}
        />
      </div>

      {/* M8 — okno vytvoření zadání (prompt z výběru komentářů) */}
      {promptDraft && (
        <CreatePromptDialog
          open={promptDraft !== null}
          onOpenChange={(v) => {
            if (!v) setPromptDraft(null);
          }}
          documentId={documentId}
          documentVersionId={versionId}
          documentName={name}
          defaultTitle={promptDraft.title}
          defaultBody={promptDraft.body}
          commentIds={promptDraft.commentIds}
          onCreated={() => {
            setExportCount((c) => c + 1);
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* M8 — okno „Předaná zadání" (historie + stavy) */}
      {canCreatePrompt && (
        <PromptExportsDialog
          open={exportsOpen}
          onOpenChange={setExportsOpen}
          documentId={documentId}
          documentName={name}
          canManage={canCreatePrompt}
          currentUserId={currentUserId}
          isAuthor={isAuthor}
          onCountChange={setExportCount}
        />
      )}
    </div>
    </PresenceTypingProvider>
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
