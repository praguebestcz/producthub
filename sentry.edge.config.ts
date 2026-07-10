import * as Sentry from "@sentry/nextjs";

// Sentry pro edge runtime (proxy.ts / edge funkce) — načítá se z instrumentation.ts.
// DSN se doplní při nasazení (M4); bez DSN je Sentry vypnuté.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" && !!process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
