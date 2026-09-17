-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE INDEX "notifications_type_dedupeKey_idx" ON "notifications"("type", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");
