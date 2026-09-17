import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyPaymentToExpense,
  applyPaymentToInvoice,
  assertValidExpensePaidAmount,
  calculateGrossAmount,
  calculateTaxAmount,
  computeBudgetLine,
  computeProjectOverview,
  formatMoneyDe,
  money,
  remainingBalance,
  resolveInvoiceStatus,
} from './index';

describe('financial-core money helpers', () => {
  it('calculates German standard VAT correctly', () => {
    const tax = calculateTaxAmount('100.00', 19);
    assert.equal(tax.toFixed(2), '19.00');
    const gross = calculateGrossAmount('100.00', 19);
    assert.equal(gross.toFixed(2), '119.00');
  });

  it('avoids floating-point drift for common amounts', () => {
    const result = money('0.1').plus('0.2');
    assert.equal(result.toFixed(2), '0.30');
  });

  it('formats EUR in de-DE locale', () => {
    const formatted = formatMoneyDe('1234.56');
    assert.match(formatted, /1\.234,56/);
  });
});

describe('computeProjectOverview', () => {
  it('matches the master-prompt example numbers', () => {
    const overview = computeProjectOverview({
      contractValue: '500000',
      currentBudget: '380000',
      actualCosts: '210000',
      committedCosts: '50000',
      revenueReceived: '250000',
      outstandingRevenue: '70000',
      financeDataAvailable: true,
    });

    assert.equal(overview.currentProfit, '40000.0000');
    assert.equal(overview.projectedProfit, '240000.0000');
    assert.equal(overview.profitMarginPercent, '48.00');
    assert.equal(overview.remainingBudget, '120000.0000');
  });
});

describe('invoice payments', () => {
  it('applies partial payments and marks paid when complete', () => {
    const first = applyPaymentToInvoice({
      grossAmount: '119.00',
      paidAmount: '0',
      paymentAmount: '50',
      currentStatus: 'OPEN',
      dueDate: '2099-01-01',
    });
    assert.equal(first.status, 'PARTIALLY_PAID');
    assert.equal(first.remainingAmount, '69.0000');

    const second = applyPaymentToInvoice({
      grossAmount: '119.00',
      paidAmount: first.newPaidAmount,
      paymentAmount: '69',
      currentStatus: first.status,
      dueDate: '2099-01-01',
    });
    assert.equal(second.status, 'PAID');
    assert.equal(second.remainingAmount, '0.0000');
  });

  it('rejects overpayment', () => {
    assert.throws(() =>
      applyPaymentToInvoice({
        grossAmount: '100',
        paidAmount: '80',
        paymentAmount: '30',
        currentStatus: 'PARTIALLY_PAID',
        dueDate: '2099-01-01',
      }),
    );
  });

  it('marks open invoices overdue by due date', () => {
    const status = resolveInvoiceStatus({
      currentStatus: 'OPEN',
      grossAmount: '100',
      paidAmount: '0',
      dueDate: '2020-01-01',
      asOf: new Date('2026-01-01'),
    });
    assert.equal(status, 'OVERDUE');
  });

  it('computes remaining balance', () => {
    assert.equal(remainingBalance('100', '40').toFixed(2), '60.00');
  });
});

describe('expense payments', () => {
  it('rejects negative and over-gross paid amounts', () => {
    assert.throws(() => assertValidExpensePaidAmount('-1', '100'));
    assert.throws(() => assertValidExpensePaidAmount('150', '100'));
    assert.doesNotThrow(() => assertValidExpensePaidAmount('50', '100'));
  });

  it('applies expense payments without exceeding balance', () => {
    const first = applyPaymentToExpense({
      grossAmount: '119',
      paidAmount: '0',
      paymentAmount: '50',
      currentStatus: 'APPROVED',
      dueDate: '2099-01-01',
    });
    assert.equal(first.newPaidAmount, '50.0000');
    assert.equal(first.status, 'PARTIALLY_PAID');
    assert.throws(() =>
      applyPaymentToExpense({
        grossAmount: '119',
        paidAmount: first.newPaidAmount,
        paymentAmount: '100',
        currentStatus: 'PARTIALLY_PAID',
        dueDate: '2099-01-01',
      }),
    );
  });
});

describe('budget lines', () => {
  it('computes remaining and variance', () => {
    const line = computeBudgetLine({
      plannedAmount: '1000',
      committedAmount: '200',
      actualAmount: '300',
    });
    assert.equal(line.remainingAmount, '500.0000');
    assert.equal(line.variancePercent, '50.00');
  });
});
