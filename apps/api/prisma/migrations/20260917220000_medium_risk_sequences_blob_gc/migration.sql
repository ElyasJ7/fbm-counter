-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "storageKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "purgedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "documents_deletedAt_purgedAt_idx" ON "documents"("deletedAt", "purgedAt");

-- CreateTable
CREATE TABLE "number_sequences" (
    "key" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("key")
);
