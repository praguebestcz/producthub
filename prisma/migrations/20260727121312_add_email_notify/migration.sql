-- CreateEnum
CREATE TYPE "EmailNotify" AS ENUM ('OFF', 'IMMEDIATE', 'UNREAD');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotify" "EmailNotify" NOT NULL DEFAULT 'OFF';

-- Backfill (security review 2026-07-27): existující notifikace označit jako již
-- vyřízené e-mailem, aby po přepnutí uživatele na "jen nepřečtené" nepřišla
-- záplava historických e-mailů. Nové notifikace vznikají s emailedAt = NULL.
UPDATE "Notification" SET "emailedAt" = "createdAt" WHERE "emailedAt" IS NULL;

-- Partikulární index (security review): úloha na pozadí (režim UNREAD) hledá jen
-- "čekající" notifikace (neodeslané a nepřečtené). Částečný index je řádově menší
-- než plný a řádky z něj vypadnou hned po přečtení/odeslání.
CREATE INDEX "Notification_pending_email_idx"
  ON "Notification" ("createdAt")
  WHERE "emailedAt" IS NULL AND "readAt" IS NULL;
