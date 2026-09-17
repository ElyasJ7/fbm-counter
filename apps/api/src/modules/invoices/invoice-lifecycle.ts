/**
 * Invoice financial lifecycle guards.
 *
 * DRAFT → fully editable (paidAmount always 0 / payment-derived)
 * SENT / OPEN / OVERDUE → issued: financial fields locked
 * PARTIALLY_PAID / PAID → financial values locked
 * CANCELLED → no financial edits
 *
 * paidAmount is never accepted from client DTOs; it is derived from Payment rows.
 */

export const INVOICE_FINANCIAL_FIELDS = [
  'type',
  'customerId',
  'supplierId',
  'subcontractorId',
  'netAmount',
  'taxRate',
  'items',
  'paidAmount',
] as const;

export type InvoiceFinancialField = (typeof INVOICE_FINANCIAL_FIELDS)[number];

const LOCKED_FINANCIAL_STATUSES = new Set([
  'SENT',
  'OPEN',
  'OVERDUE',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
]);

export function isInvoiceFinanciallyLocked(status: string): boolean {
  return LOCKED_FINANCIAL_STATUSES.has(status);
}

export function collectAttemptedFinancialFields(
  dto: Record<string, unknown>,
): InvoiceFinancialField[] {
  const attempted: InvoiceFinancialField[] = [];
  for (const field of INVOICE_FINANCIAL_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(dto, field) &&
      dto[field] !== undefined
    ) {
      attempted.push(field);
    }
  }
  return attempted;
}

export function assertInvoiceFinancialEditAllowed(
  status: string,
  dto: Record<string, unknown>,
): void {
  if (!isInvoiceFinanciallyLocked(status)) {
    if (
      Object.prototype.hasOwnProperty.call(dto, 'paidAmount') &&
      dto.paidAmount !== undefined
    ) {
      throw new Error(
        'paidAmount cannot be set directly; record a payment instead',
      );
    }
    return;
  }

  const attempted = collectAttemptedFinancialFields(dto);
  if (attempted.length === 0) return;

  if (attempted.includes('paidAmount')) {
    throw new Error(
      'paidAmount cannot be set directly; record a payment instead',
    );
  }

  throw new Error(
    `Cannot modify financial fields (${attempted.join(', ')}) on invoice with status ${status}`,
  );
}

export function assertInvoiceDeletable(input: {
  status: string;
  paymentCount: number;
}): void {
  if (input.paymentCount > 0) {
    throw new Error(
      'Cannot delete invoice with payments; reverse payments first',
    );
  }
  if (input.status === 'PARTIALLY_PAID' || input.status === 'PAID') {
    throw new Error(`Cannot delete invoice in status ${input.status}`);
  }
}
