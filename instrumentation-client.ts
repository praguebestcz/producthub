import * as Sentry from "@sentry/nextjs";

// Sentry v prohlížeči (klientská instrumentace).
// NEXT_PUBLIC_SENTRY_DSN se doplní při nasazení (M4); bez DSN je Sentry vypnuté.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled:
    process.env.NODE_ENV === "production" &&
    !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// Instrumentace navigací v App Routeru.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
