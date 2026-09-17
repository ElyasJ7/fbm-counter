import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

function money(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/**
 * Cost accounting policy (FBM Counter)
 * ------------------------------------
 * Source of truth for payable partner costs: SUPPLIER invoices.
 * Expenses are operational costs. If an expense.invoiceNumber matches a
 * non-deleted SUPPLIER invoice.invoiceNumber (case-insensitive trim), the
 * expense is treated as a duplicate of that invoice and is EXCLUDED from
 * cost aggregations (invoice wins).
 *
 * Definitions:
 * - Actual cost   = Σ SUPPLIER.paidAmount + Σ non-duplicate Expense.paidAmount
 * - Committed     = Σ open SUPPLIER remaining + Σ open non-duplicate Expense remaining
 * - AP            = Σ open SUPPLIER remaining (invoice ledger only)
 * - Supplier spend= Σ SUPPLIER.paidAmount for that supplier (+ non-dup expenses)
 * - Revenue       = Σ CUSTOMER.paidAmount (unchanged)
 * - Project profit= revenueReceived − actualCosts
 */

const OPEN_SUPPLIER_STATUSES = new Set([
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
]);

const OPEN_EXPENSE_STATUSES = new Set([
  'PENDING',
  'APPROVED',
  'PARTIALLY_PAID',
  'OVERDUE',
]);

const CANCELLED_OR_DRAFT_INVOICE = new Set(['CANCELLED', 'DRAFT']);
const CANCELLED_EXPENSE = new Set(['CANCELLED']);

export type CostMoneyRow = {
  status: string;
  grossAmount: string | number | Decimal;
  paidAmount: string | number | Decimal;
  invoiceNumber?: string | null;
  category?: string | null;
  supplierId?: string | null;
};

export type AggregatedCosts = {
  actualCosts: string;
  committedCosts: string;
  accountsPayable: string;
  /** Category → { actual, committed } for budget sync (supplier invoices → OTHER). */
  byCategory: Record<string, { actual: string; committed: string }>;
};

function asMoneyString(value: Decimal): string {
  return value.toDecimalPlaces(4).toFixed(4);
}

export function normalizeInvoiceKey(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function buildSupplierInvoiceNumberSet(
  supplierInvoices: Array<{ invoiceNumber: string; status?: string }>,
): Set<string> {
  const keys = new Set<string>();
  for (const invoice of supplierInvoices) {
    if (invoice.status && CANCELLED_OR_DRAFT_INVOICE.has(invoice.status)) {
      continue;
    }
    const key = normalizeInvoiceKey(invoice.invoiceNumber);
    if (key) keys.add(key);
  }
  return keys;
}

export function expenseDuplicatesSupplierInvoice(
  expenseInvoiceNumber: string | null | undefined,
  supplierInvoiceNumbers: Set<string>,
): boolean {
  const key = normalizeInvoiceKey(expenseInvoiceNumber);
  return key != null && supplierInvoiceNumbers.has(key);
}

function remainingOf(row: CostMoneyRow): Decimal {
  const rem = money(row.grossAmount).minus(money(row.paidAmount));
  return rem.isNegative() ? money(0) : rem;
}

/**
 * Aggregate project/company costs with invoice-wins deduplication.
 */
export function aggregateCosts(input: {
  supplierInvoices: CostMoneyRow[];
  expenses: CostMoneyRow[];
  /** Default bucket for supplier invoice amounts without a category. */
  supplierInvoiceCategory?: string;
}): AggregatedCosts {
  const supplierCategory = input.supplierInvoiceCategory ?? 'OTHER';
  const invoiceKeys = buildSupplierInvoiceNumberSet(
    input.supplierInvoices.map((row) => ({
      invoiceNumber: String(row.invoiceNumber ?? ''),
      status: row.status,
    })),
  );

  let actual = money(0);
  let committed = money(0);
  let accountsPayable = money(0);
  const byCategory = new Map<
    string,
    { actual: Decimal; committed: Decimal }
  >();

  const bump = (
    category: string,
    actualDelta: Decimal,
    committedDelta: Decimal,
  ) => {
    const current = byCategory.get(category) ?? {
      actual: money(0),
      committed: money(0),
    };
    byCategory.set(category, {
      actual: current.actual.plus(actualDelta),
      committed: current.committed.plus(committedDelta),
    });
  };

  for (const invoice of input.supplierInvoices) {
    if (CANCELLED_OR_DRAFT_INVOICE.has(invoice.status)) continue;
    const paid = money(invoice.paidAmount);
    actual = actual.plus(paid);
    bump(supplierCategory, paid, money(0));

    const rem = remainingOf(invoice);
    if (OPEN_SUPPLIER_STATUSES.has(invoice.status) && rem.greaterThan(0)) {
      committed = committed.plus(rem);
      accountsPayable = accountsPayable.plus(rem);
      bump(supplierCategory, money(0), rem);
    }
  }

  for (const expense of input.expenses) {
    if (CANCELLED_EXPENSE.has(expense.status)) continue;
    if (
      expenseDuplicatesSupplierInvoice(expense.invoiceNumber, invoiceKeys)
    ) {
      continue;
    }

    const paid = money(expense.paidAmount);
    actual = actual.plus(paid);
    const category = expense.category?.trim() || 'OTHER';
    bump(category, paid, money(0));

    const rem = remainingOf(expense);
    if (OPEN_EXPENSE_STATUSES.has(expense.status) && rem.greaterThan(0)) {
      committed = committed.plus(rem);
      bump(category, money(0), rem);
    }
  }

  const byCategoryOut: AggregatedCosts['byCategory'] = {};
  for (const [category, amounts] of byCategory) {
    byCategoryOut[category] = {
      actual: asMoneyString(amounts.actual),
      committed: asMoneyString(amounts.committed),
    };
  }

  return {
    actualCosts: asMoneyString(actual),
    committedCosts: asMoneyString(committed),
    accountsPayable: asMoneyString(accountsPayable),
    byCategory: byCategoryOut,
  };
}

/** Supplier-facing spend: invoices for supplier + non-duplicate expenses. */
export function aggregateSupplierSpend(input: {
  supplierInvoices: CostMoneyRow[];
  expenses: CostMoneyRow[];
}): {
  totalPurchases: string;
  paidAmount: string;
  outstandingBalance: string;
} {
  const invoiceKeys = buildSupplierInvoiceNumberSet(
    input.supplierInvoices.map((row) => ({
      invoiceNumber: String(row.invoiceNumber ?? ''),
      status: row.status,
    })),
  );

  let totalPurchases = money(0);
  let paid = money(0);
  let outstanding = money(0);

  for (const invoice of input.supplierInvoices) {
    if (CANCELLED_OR_DRAFT_INVOICE.has(invoice.status)) continue;
    totalPurchases = totalPurchases.plus(invoice.grossAmount);
    paid = paid.plus(invoice.paidAmount);
    if (OPEN_SUPPLIER_STATUSES.has(invoice.status)) {
      outstanding = outstanding.plus(remainingOf(invoice));
    }
  }

  for (const expense of input.expenses) {
    if (CANCELLED_EXPENSE.has(expense.status)) continue;
    if (
      expenseDuplicatesSupplierInvoice(expense.invoiceNumber, invoiceKeys)
    ) {
      continue;
    }
    totalPurchases = totalPurchases.plus(expense.grossAmount);
    paid = paid.plus(expense.paidAmount);
    if (OPEN_EXPENSE_STATUSES.has(expense.status)) {
      outstanding = outstanding.plus(remainingOf(expense));
    }
  }

  return {
    totalPurchases: asMoneyString(totalPurchases),
    paidAmount: asMoneyString(paid),
    outstandingBalance: asMoneyString(outstanding),
  };
}
