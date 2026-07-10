import * as Sentry from "@sentry/nextjs";

// Sentry pro serverový (Node) runtime — načítá se z instrumentation.ts.
// Self-hosted Sentry PragueBest. DSN se doplní při nasazení (milník M4);
// bez DSN je Sentry vypnuté, lokální vývoj nic neposílá.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" && !!process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
