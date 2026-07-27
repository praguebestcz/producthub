// Paměťový hub notifikací (M7 - živý zvoneček). Drží otevřená SSE spojení per
// UŽIVATEL. Když uživateli vznikne notifikace, pošle jeho spojením signál
// „notifications" BEZ dat - klient si nepřečtené natáhne přes GET
// /api/notifications s vlastní session. Data se tedy hubem neposílají (stejný
// princip jako signalCommentsChanged u přítomnosti - nic k úniku interního obsahu).
//
// Omezení (shodné s presence hubem): stav je v paměti JEDNÉ instance. Na Railway
// běží 1 instance → OK. Horizontální škálování by řešilo Postgres LISTEN/NOTIFY (v2).

type Conn = {
  connId: string;
  send: (event: string, data: unknown) => void;
};

// Singleton přežije hot-reload v devu (drží se na globalThis, vzor Prisma/presence).
const g = globalThis as unknown as {
  __phNotifV1?: Map<number, Map<string, Conn>>;
};
const users: Map<number, Map<string, Conn>> = (g.__phNotifV1 ??= new Map());

// Přihlásí spojení uživatele (víc záložek = víc spojení).
export function subscribe(userId: number, conn: Conn): void {
  let m = users.get(userId);
  if (!m) {
    m = new Map();
    users.set(userId, m);
  }
  m.set(conn.connId, conn);
}

// Odhlásí spojení (zavření záložky / konec streamu).
export function unsubscribe(userId: number, connId: string): void {
  const m = users.get(userId);
  if (!m) return;
  m.delete(connId);
  if (m.size === 0) users.delete(userId);
}

// Kolik spojení má uživatel (strop proti zahlcení SSE spojeními).
export function userConnCount(userId: number): number {
  return users.get(userId)?.size ?? 0;
}

// Pošli jednomu uživateli signál „přišlo něco nového" → klient přenačte zvoneček.
export function notifyUser(userId: number): void {
  const m = users.get(userId);
  if (!m) return;
  for (const c of m.values()) {
    try {
      c.send("notifications", {});
    } catch {
      // Spadlé spojení uklidí unsubscribe přes abort - tady jen nepadnout.
    }
  }
}

// Dávkově pro víc příjemců jedné události (po vzniku notifikací ke komentáři).
export function notifyUsers(userIds: number[]): void {
  for (const id of new Set(userIds)) notifyUser(id);
}
