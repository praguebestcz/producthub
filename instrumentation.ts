import * as Sentry from "@sentry/nextjs";

// Next.js instrumentace — načte správnou Sentry konfiguraci podle runtimu.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Úloha na pozadí pro e-mailové notifikace (režim „jen nepřečtené"). Jen
    // v Node runtimu (ne edge/build); singleton uvnitř nespustí víc časovačů.
    const { startEmailSweep } = await import("./lib/notifications/email-sweep");
    startEmailSweep();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Zachytí chyby vzniklé při renderování serverových komponent / route handlerů.
export const onRequestError = Sentry.captureRequestError;
