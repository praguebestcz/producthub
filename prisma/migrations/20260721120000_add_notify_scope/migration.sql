-- CreateEnum
CREATE TYPE "NotifyScope" AS ENUM ('ALL', 'INVOLVED');

-- AlterTable: nový sloupec s defaultem ALL (dosavadní chování) — žádný backfill.
ALTER TABLE "User" ADD COLUMN "notifyScope" "NotifyScope" NOT NULL DEFAULT 'ALL';
