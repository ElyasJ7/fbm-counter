import { Prisma } from '@prisma/client';

export type LockedInvoiceRow = {
  id: string;
  type: string;
  status: string;
  grossAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  dueDate: Date;
  projectId: string | null;
};

/**
 * Lock invoice row for payment mutation (PostgreSQL SELECT … FOR UPDATE).
 * Must run inside an interactive transaction.
 */
export async function lockInvoiceForUpdate(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<LockedInvoiceRow | null> {
  const rows = await tx.$queryRaw<LockedInvoiceRow[]>`
    SELECT
      id,
      type,
      status,
      "grossAmount",
      "paidAmount",
      "dueDate",
      "projectId"
    FROM invoices
    WHERE id = ${invoiceId}
      AND "deletedAt" IS NULL
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function sumValidPaymentAmount(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<string> {
  const paymentSum = await tx.payment.aggregate({
    where: { invoiceId, deletedAt: null },
    _sum: { amount: true },
  });
  const total = paymentSum._sum.amount;
  return total ? total.toDecimalPlaces(4).toFixed(4) : '0.0000';
}
