import * as Sentry from "@sentry/nextjs";

// Next.js instrumentace — načte správnou Sentry konfiguraci podle runtimu.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Zachytí chyby vzniklé při renderování serverových komponent / route handlerů.
export const onRequestError = Sentry.captureRequestError;
