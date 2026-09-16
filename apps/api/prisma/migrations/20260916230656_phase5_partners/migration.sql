-- CreateEnum
CREATE TYPE "SubcontractorTrade" AS ENUM ('ELECTRICAL', 'PLUMBING', 'ROOFING', 'CONCRETE', 'PAINTING', 'CARPENTRY', 'HVAC', 'OTHER');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "subcontractorId" TEXT;

-- CreateTable
CREATE TABLE "subcontractors" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "trade" "SubcontractorTrade" NOT NULL DEFAULT 'OTHER',
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "vatId" TEXT,
    "taxNumber" TEXT,
    "contractValue" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subcontractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_subcontractors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "contractValue" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_subcontractors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subcontractors_companyName_idx" ON "subcontractors"("companyName");

-- CreateIndex
CREATE INDEX "subcontractors_trade_idx" ON "subcontractors"("trade");

-- CreateIndex
CREATE INDEX "subcontractors_deletedAt_idx" ON "subcontractors"("deletedAt");

-- CreateIndex
CREATE INDEX "project_subcontractors_projectId_idx" ON "project_subcontractors"("projectId");

-- CreateIndex
CREATE INDEX "project_subcontractors_subcontractorId_idx" ON "project_subcontractors"("subcontractorId");

-- CreateIndex
CREATE UNIQUE INDEX "project_subcontractors_projectId_subcontractorId_key" ON "project_subcontractors"("projectId", "subcontractorId");

-- CreateIndex
CREATE INDEX "invoices_subcontractorId_idx" ON "invoices"("subcontractorId");

-- AddForeignKey
ALTER TABLE "project_subcontractors" ADD CONSTRAINT "project_subcontractors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subcontractors" ADD CONSTRAINT "project_subcontractors_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
