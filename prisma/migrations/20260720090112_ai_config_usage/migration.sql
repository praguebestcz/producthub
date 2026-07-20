-- CreateTable
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "anthropicApiKeyEnc" TEXT,
    "anthropicApiKeyLast4" VARCHAR(8),
    "monthlyGenerationLimit" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER,
    "userId" INTEGER,
    "model" VARCHAR(64) NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_projectId_idx" ON "AiUsage"("projectId");

-- CreateIndex
CREATE INDEX "AiUsage_userId_idx" ON "AiUsage"("userId");

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Obrana do hloubky (po db-security-expert review 2026-07-20). Prisma je
-- z anotací negeneruje — dopsáno ručně.
-- AppConfig: jediný řádek (id=1) + nezáporný limit + seed prázdné konfigurace.
ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_limit_nonneg" CHECK ("monthlyGenerationLimit" >= 0);
INSERT INTO "AppConfig" ("id", "monthlyGenerationLimit", "updatedAt")
  VALUES (1, 0, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;

-- AiUsage: nezáporné tokeny.
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_inputTokens_nonneg" CHECK ("inputTokens" >= 0);
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_outputTokens_nonneg" CHECK ("outputTokens" >= 0);
