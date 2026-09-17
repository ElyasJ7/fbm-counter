-- Performance: composite indexes for common list/dashboard filters
CREATE INDEX IF NOT EXISTS "invoices_deletedAt_type_status_idx" ON "invoices"("deletedAt", "type", "status");
CREATE INDEX IF NOT EXISTS "invoices_deletedAt_projectId_issueDate_idx" ON "invoices"("deletedAt", "projectId", "issueDate");
CREATE INDEX IF NOT EXISTS "expenses_deletedAt_status_invoiceDate_idx" ON "expenses"("deletedAt", "status", "invoiceDate");
CREATE INDEX IF NOT EXISTS "payments_deletedAt_paymentDate_idx" ON "payments"("deletedAt", "paymentDate");
