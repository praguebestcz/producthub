import { computeRoster, type PresentUser } from "./roster";

// Paměťový hub přítomnosti (M7 Fáze 2). Drží otevřená SSE spojení per dokument
// a množinu právě píšících. Rozesílá KAŽDÉMU spojení seznam PROFILTROVANÝ jeho
// oprávněním (externí nevidí interní) - filtr je vždy na serveru.
//
// Omezení (známé, zapsáno ve specu): stav je v paměti JEDNÉ instance. Na Railway
// běží 1 instance, takže OK. Při horizontálním škálování by přítomnost z jedné
// instance neviděla druhá (řešilo by se Postgres LISTEN/NOTIFY až v2).

type Conn = {
  connId: string;
  userId: number;
  name: string;
  avatarUrl: string | null;
  // internal = člen týmu PB (canSeeInternal). Externí ho v seznamu nevidí a
  // zároveň určuje, zda TENTO příjemce smí vidět interní přítomné.
  internal: boolean;
  send: (event: string, data: unknown) => void;
};

type DocState = {
  conns: Map<string, Conn>; // connId → Conn
  typing: Set<number>; // userId, kteří právě píší
};

// Singleton přežije hot-reload v devu (drží se na globalThis, vzor Prisma).
const g = globalThis as unknown as { __phPresence?: Map<number, DocState> };
const docs: Map<number, DocState> = (g.__phPresence ??= new Map());

function stateFor(documentId: number): DocState {
  let s = docs.get(documentId);
  if (!s) {
    s = { conns: new Map(), typing: new Set() };
    docs.set(documentId, s);
  }
  return s;
}

function presentUsers(s: DocState): PresentUser[] {
  return [...s.conns.values()].map((c) => ({
    userId: c.userId,
    name: c.name,
    avatarUrl: c.avatarUrl,
    internal: c.internal,
  }));
}

// Rozešli aktuální (profiltrovaný) seznam přítomných všem spojením dokumentu.
export function broadcast(documentId: number): void {
  const s = docs.get(documentId);
  if (!s) return;
  const present = presentUsers(s);
  for (const c of s.conns.values()) {
    const users = computeRoster(present, s.typing, {
      userId: c.userId,
      canSeeInternal: c.internal,
    });
    try {
      c.send("presence", { users });
    } catch {
      // Spadlé spojení uklidí leave() přes abort/cancel - tady jen nepadnout.
    }
  }
}

// Připojení / aktualizace spojení (upsert - heartbeat může obnovit `internal`).
export function join(documentId: number, conn: Conn): void {
  stateFor(documentId).conns.set(conn.connId, conn);
  broadcast(documentId);
}

// Odpojení spojení. Když uživateli nezbylo žádné spojení, přestane „psát".
export function leave(documentId: number, connId: string): void {
  const s = docs.get(documentId);
  if (!s) return;
  const conn = s.conns.get(connId);
  s.conns.delete(connId);
  if (conn && ![...s.conns.values()].some((c) => c.userId === conn.userId)) {
    s.typing.delete(conn.userId);
  }
  if (s.conns.size === 0) docs.delete(documentId);
  else broadcast(documentId);
}

// Nastav „píše / přestal psát" pro uživatele (jen když je opravdu přítomen).
export function setTyping(
  documentId: number,
  userId: number,
  typing: boolean,
): void {
  const s = docs.get(documentId);
  if (!s) return;
  if (![...s.conns.values()].some((c) => c.userId === userId)) return;
  if (typing) s.typing.add(userId);
  else s.typing.delete(userId);
  broadcast(documentId);
}
