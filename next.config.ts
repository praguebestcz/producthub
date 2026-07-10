import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  org: "praguebest",
  project: "producthub-nextjs",
  sentryUrl: "https://sentry.praguebest.cz/",
  // Source-mapy se nahrávají do Sentry jen když je při buildu nastaven SENTRY_AUTH_TOKEN
  // (jinak se krok přeskočí — build nespadne). Token patří do Railway build variables.
  silent: !process.env.CI,
});
