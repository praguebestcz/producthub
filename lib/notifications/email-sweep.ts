import { prisma } from "@/lib/prisma";
import { dispatchNotificationEmails } from "./email-dispatch";

// Úloha na pozadí pro režim „jen nepřečtené" (UNREAD). Každé 2 minuty najde
// notifikace, které jsou po prodlevě (5 min) stále NEPŘEČTENÉ a NEODESLANÉ, a
// pošle je. Kdo si upozornění v aplikaci přečte dřív, e-mail nedostane.
//
// Spodní i horní časová mez (security review): posílá jen notifikace mladší než
// 24 h - starší už nikdy (brání záplavě historie i zacyklení při výpadku SMTP).
//
// Běží v paměti jedné instance (Railway 1 instance, always-on). Singleton přes
// globalThis (přežije hot-reload v devu, nespustí víc časovačů).

const SWEEP_INTERVAL_MS = 2 * 60_000; // jak často úloha běží
const DELAY_MS = 5 * 60_000; // prodleva: e-mail až po 5 min nepřečtení
const MAX_AGE_MS = 24 * 60 * 60_000; // starší notifikace už neposílat
const BATCH = 200; // strop na jeden běh (proti zahlcení SMTP)

async function sweepOnce(): Promise<void> {
  const now = Date.now();
  const candidates = await prisma.notification.findMany({
    where: {
      emailedAt: null,
      readAt: null,
      createdAt: {
        lt: new Date(now - DELAY_MS), // starší než prodleva
        gt: new Date(now - MAX_AGE_MS), // ne starší než 24 h
      },
      user: { emailNotify: "UNREAD", deactivatedAt: null },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true },
  });
  if (candidates.length === 0) return;
  await dispatchNotificationEmails(
    candidates.map((c) => c.id),
    "UNREAD",
  );
}

const g = globalThis as unknown as { __phEmailSweep?: boolean };

export function startEmailSweep(): void {
  if (g.__phEmailSweep) return; // už běží (hot-reload / dvojí import)
  g.__phEmailSweep = true;
  const run = () => {
    sweepOnce().catch((err) => {
      console.error("[email-sweep] chyba běhu", {
        message: err instanceof Error ? err.message : "neznámá chyba",
      });
    });
  };
  setInterval(run, SWEEP_INTERVAL_MS);
}
