-- CreateEnum
CREATE TYPE "PromptExportStatus" AS ENUM ('CREATED', 'HANDED_OFF', 'DONE');

-- CreateTable
CREATE TABLE "PromptExport" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "documentVersionId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "commentIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" "PromptExportStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptExport_documentId_idx" ON "PromptExport"("documentId");

-- CreateIndex
CREATE INDEX "PromptExport_documentVersionId_idx" ON "PromptExport"("documentVersionId");

-- CreateIndex
CREATE INDEX "PromptExport_createdById_idx" ON "PromptExport"("createdById");

-- AddForeignKey
ALTER TABLE "PromptExport" ADD CONSTRAINT "PromptExport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExport" ADD CONSTRAINT "PromptExport_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExport" ADD CONSTRAINT "PromptExport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Obrana do hloubky (po db-security-expert review 2026-07-17): stropy velikosti
-- pod aplikačními limity. Prisma je z anotací negeneruje — dopsáno ručně.
ALTER TABLE "PromptExport" ADD CONSTRAINT "PromptExport_body_max_size" CHECK (octet_length("body") <= 1048576);
ALTER TABLE "PromptExport" ADD CONSTRAINT "PromptExport_commentIds_max" CHECK (array_length("commentIds", 1) IS NULL OR array_length("commentIds", 1) <= 500);
