export { Decimal, money, asMoneyString } from './money';
import { money, asMoneyString, type Decimal } from './money';
import { computeHeaderVat } from './vat';

export function formatMoneyDe(
  value: string | number | Decimal,
  currency = 'EUR',
): string {
  const amount = money(value).toDecimalPlaces(2).toNumber();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function calculateTaxAmount(
  netAmount: string | number | Decimal,
  taxRatePercent: string | number | Decimal,
) {
  return money(computeHeaderVat(netAmount, taxRatePercent).taxAmount);
}

export function calculateGrossAmount(
  netAmount: string | number | Decimal,
  taxRatePercent: string | number | Decimal,
) {
  return money(computeHeaderVat(netAmount, taxRatePercent).grossAmount);
}

export type ProjectOverviewInput = {
  contractValue: string | number | Decimal;
  currentBudget: string | number | Decimal;
  actualCosts?: string | number | Decimal;
  committedCosts?: string | number | Decimal;
  revenueReceived?: string | number | Decimal;
  outstandingRevenue?: string | number | Decimal;
  forecastTotalCosts?: string | number | Decimal;
  currency?: string;
  financeDataAvailable?: boolean;
};

export type ProjectOverviewResult = {
  contractValue: string;
  budget: string;
  actualCosts: string;
  committedCosts: string;
  revenueReceived: string;
  outstandingRevenue: string;
  currentProfit: string;
  projectedProfit: string;
  profitMarginPercent: string | null;
  remainingBudget: string;
  currency: string;
  financeDataAvailable: boolean;
};

export function computeProjectOverview(
  input: ProjectOverviewInput,
): ProjectOverviewResult {
  const contractValue = money(input.contractValue);
  const budget = money(input.currentBudget);
  const actualCosts = money(input.actualCosts ?? 0);
  const committedCosts = money(input.committedCosts ?? 0);
  const revenueReceived = money(input.revenueReceived ?? 0);
  const outstandingRevenue = money(input.outstandingRevenue ?? 0);
  const forecastTotalCosts = money(
    input.forecastTotalCosts ?? actualCosts.plus(committedCosts),
  );

  const currentProfit = revenueReceived.minus(actualCosts);
  const projectedProfit = contractValue.minus(forecastTotalCosts);
  const remainingBudget = budget.minus(actualCosts).minus(committedCosts);

  const profitMarginPercent = contractValue.isZero()
    ? null
    : projectedProfit.div(contractValue).mul(100).toDecimalPlaces(2).toFixed(2);

  return {
    contractValue: asMoneyString(contractValue),
    budget: asMoneyString(budget),
    actualCosts: asMoneyString(actualCosts),
    committedCosts: asMoneyString(committedCosts),
    revenueReceived: asMoneyString(revenueReceived),
    outstandingRevenue: asMoneyString(outstandingRevenue),
    currentProfit: asMoneyString(currentProfit),
    projectedProfit: asMoneyString(projectedProfit),
    profitMarginPercent,
    remainingBudget: asMoneyString(remainingBudget),
    currency: input.currency ?? 'EUR',
    financeDataAvailable: input.financeDataAvailable ?? false,
  };
}

export type InvoiceStatusName =
  | 'DRAFT'
  | 'SENT'
  | 'OPEN'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export type ResolveInvoiceStatusInput = {
  currentStatus: InvoiceStatusName;
  grossAmount: string | number | Decimal;
  paidAmount: string | number | Decimal;
  dueDate: Date | string;
  asOf?: Date;
};

/**
 * Derive invoice status from balances and due date.
 * CANCELLED and DRAFT are preserved unless fully paid after issuance.
 */
export function resolveInvoiceStatus(
  input: ResolveInvoiceStatusInput,
): InvoiceStatusName {
  if (input.currentStatus === 'CANCELLED') {
    return 'CANCELLED';
  }

  const gross = money(input.grossAmount);
  const paid = money(input.paidAmount);
  const remaining = gross.minus(paid);

  if (paid.greaterThan(0) && remaining.lessThanOrEqualTo(0)) {
    return 'PAID';
  }

  if (input.currentStatus === 'DRAFT') {
    return 'DRAFT';
  }

  if (paid.greaterThan(0) && remaining.greaterThan(0)) {
    const due = new Date(input.dueDate);
    const asOf = input.asOf ?? new Date();
    if (due < startOfDay(asOf)) {
      return 'OVERDUE';
    }
    return 'PARTIALLY_PAID';
  }

  const due = new Date(input.dueDate);
  const asOf = input.asOf ?? new Date();
  if (remaining.greaterThan(0) && due < startOfDay(asOf)) {
    return 'OVERDUE';
  }

  if (input.currentStatus === 'SENT') {
    return 'SENT';
  }

  return remaining.greaterThan(0) ? 'OPEN' : 'PAID';
}

export function remainingBalance(
  grossAmount: string | number | Decimal,
  paidAmount: string | number | Decimal,
): Decimal {
  const remaining = money(grossAmount).minus(money(paidAmount));
  return remaining.isNegative() ? money(0) : remaining.toDecimalPlaces(4);
}

export type ApplyPaymentResult = {
  newPaidAmount: string;
  remainingAmount: string;
  status: InvoiceStatusName;
};

/**
 * Apply a payment to an invoice. Throws if amount exceeds remaining balance.
 */
export function applyPaymentToInvoice(input: {
  grossAmount: string | number | Decimal;
  paidAmount: string | number | Decimal;
  paymentAmount: string | number | Decimal;
  currentStatus: InvoiceStatusName;
  dueDate: Date | string;
  asOf?: Date;
}): ApplyPaymentResult {
  const payment = money(input.paymentAmount);
  if (payment.lessThanOrEqualTo(0)) {
    throw new Error('Payment amount must be greater than zero');
  }

  const remaining = remainingBalance(input.grossAmount, input.paidAmount);
  if (payment.greaterThan(remaining)) {
    throw new Error('Payment exceeds outstanding balance');
  }

  const newPaid = money(input.paidAmount).plus(payment).toDecimalPlaces(4);
  const status = resolveInvoiceStatus({
    currentStatus:
      input.currentStatus === 'DRAFT' ? 'OPEN' : input.currentStatus,
    grossAmount: input.grossAmount,
    paidAmount: newPaid,
    dueDate: input.dueDate,
    asOf: input.asOf,
  });

  return {
    newPaidAmount: asMoneyString(newPaid),
    remainingAmount: asMoneyString(remainingBalance(input.grossAmount, newPaid)),
    status,
  };
}

export type BudgetLineInput = {
  plannedAmount: string | number | Decimal;
  committedAmount: string | number | Decimal;
  actualAmount: string | number | Decimal;
};

export type BudgetLineResult = {
  plannedAmount: string;
  committedAmount: string;
  actualAmount: string;
  remainingAmount: string;
  varianceAmount: string;
  variancePercent: string | null;
};

/** Variance = planned - actual - committed (negative means overrun). */
export function computeBudgetLine(input: BudgetLineInput): BudgetLineResult {
  const planned = money(input.plannedAmount);
  const committed = money(input.committedAmount);
  const actual = money(input.actualAmount);
  const remaining = planned.minus(actual).minus(committed);
  const variance = remaining;
  const variancePercent = planned.isZero()
    ? null
    : variance.div(planned).mul(100).toDecimalPlaces(2).toFixed(2);

  return {
    plannedAmount: asMoneyString(planned),
    committedAmount: asMoneyString(committed),
    actualAmount: asMoneyString(actual),
    remainingAmount: asMoneyString(remaining),
    varianceAmount: asMoneyString(variance),
    variancePercent,
  };
}

export type ExpenseStatusName =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export function resolveExpenseStatus(input: {
  currentStatus: ExpenseStatusName;
  grossAmount: string | number | Decimal;
  paidAmount: string | number | Decimal;
  dueDate?: Date | string | null;
  asOf?: Date;
}): ExpenseStatusName {
  if (input.currentStatus === 'CANCELLED' || input.currentStatus === 'DRAFT') {
    return input.currentStatus;
  }

  const gross = money(input.grossAmount);
  const paid = money(input.paidAmount);
  const remaining = gross.minus(paid);

  if (paid.greaterThan(0) && remaining.lessThanOrEqualTo(0)) {
    return 'PAID';
  }
  if (paid.greaterThan(0) && remaining.greaterThan(0)) {
    if (input.dueDate) {
      const due = new Date(input.dueDate);
      const asOf = input.asOf ?? new Date();
      if (due < startOfDay(asOf)) return 'OVERDUE';
    }
    return 'PARTIALLY_PAID';
  }

  if (
    input.dueDate &&
    remaining.greaterThan(0) &&
    ['APPROVED', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(
      input.currentStatus,
    )
  ) {
    const due = new Date(input.dueDate);
    const asOf = input.asOf ?? new Date();
    if (due < startOfDay(asOf)) return 'OVERDUE';
  }

  return input.currentStatus;
}

/**
 * Apply a payment to an expense (controlled mutation).
 * Expense.paidAmount is not client-writable on create/update — use this path.
 */
export function applyPaymentToExpense(input: {
  grossAmount: string | number | Decimal;
  paidAmount: string | number | Decimal;
  paymentAmount: string | number | Decimal;
  currentStatus: ExpenseStatusName;
  dueDate?: Date | string | null;
  asOf?: Date;
}): {
  newPaidAmount: string;
  remainingAmount: string;
  status: ExpenseStatusName;
} {
  const payment = money(input.paymentAmount);
  if (payment.lessThanOrEqualTo(0)) {
    throw new Error('Payment amount must be greater than zero');
  }
  if (input.currentStatus === 'CANCELLED' || input.currentStatus === 'DRAFT') {
    throw new Error('Cannot apply payment to cancelled or draft expenses');
  }

  const remaining = remainingBalance(input.grossAmount, input.paidAmount);
  if (payment.greaterThan(remaining)) {
    throw new Error('Payment exceeds outstanding expense balance');
  }

  const newPaid = money(input.paidAmount).plus(payment).toDecimalPlaces(4);
  const status = resolveExpenseStatus({
    currentStatus:
      input.currentStatus === 'PENDING' ? 'APPROVED' : input.currentStatus,
    grossAmount: input.grossAmount,
    paidAmount: newPaid,
    dueDate: input.dueDate,
    asOf: input.asOf,
  });

  return {
    newPaidAmount: asMoneyString(newPaid),
    remainingAmount: asMoneyString(remainingBalance(input.grossAmount, newPaid)),
    status,
  };
}

export function assertValidExpensePaidAmount(
  paidAmount: string | number | Decimal,
  grossAmount: string | number | Decimal,
): void {
  const paid = money(paidAmount);
  const gross = money(grossAmount);
  if (paid.isNegative()) {
    throw new Error('paidAmount cannot be negative');
  }
  if (paid.greaterThan(gross)) {
    throw new Error('paidAmount cannot exceed grossAmount');
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export {
  aggregateCosts,
  aggregateSupplierSpend,
  buildSupplierInvoiceNumberSet,
  expenseDuplicatesSupplierInvoice,
  normalizeInvoiceKey,
  type AggregatedCosts,
  type CostMoneyRow,
} from './cost-policy';

export {
  computeHeaderVat,
  reconcileInvoiceTotals,
  sumLineNets,
  assertNetPlusVatEqualsGross,
  type InvoiceLineNet,
  type InvoiceVatResult,
} from './vat';

export {
  parseMoneyDe,
  parseMoneyDeToFixed,
  MoneyParseError,
} from './money-parse';

export {
  isDateOnlyString,
  toDateOnlyString,
  dateOnlyToUtcDate,
  dateOnlyToUtcStartOfDay,
  dateOnlyToUtcEndOfDay,
  formatDateOnlyDe,
  DateOnlyError,
} from './date-only';

export {
  neutralizeCsvFormula,
  csvEscapeCell,
  toCsvDocument,
} from './csv';

export {
  crossRateFromPivot,
  convertWithRate,
  invertRate,
  convertMoney,
  asDisplayMoneyString,
  type ConversionResult,
} from './fx';
