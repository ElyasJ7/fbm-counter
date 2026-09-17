import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateCosts,
  computeProjectOverview,
  money,
  remainingBalance,
  applyPaymentToInvoice,
} from './index';

/**
 * Medium-risk finance regression scenario (cash-based metrics).
 *
 * Contract 500k, budget 380k current / 350k initial (overview uses current).
 * Supplier invoice 100k paid, duplicate expense ignored, other expense 20k paid,
 * customer invoice 250k with 200k payment → AR 50k, cash received 200k,
 * actual costs 120k, profit 80k.
 */
describe('finance regression scenario', () => {
  it('matches documented cash/cost/AR outcomes', () => {
    const supplierInvoices = [
      {
        projectId: 'p1',
        invoiceNumber: 'ER-2026-0001',
        status: 'PAID',
        paidAmount: '100000',
        grossAmount: '100000',
      },
    ];
    const expenses = [
      {
        projectId: 'p1',
        invoiceNumber: 'ER-2026-0001', // duplicate of supplier invoice
        status: 'PAID',
        paidAmount: '100000',
        grossAmount: '100000',
        category: 'OTHER',
      },
      {
        projectId: 'p1',
        invoiceNumber: null,
        status: 'PAID',
        paidAmount: '20000',
        grossAmount: '20000',
        category: 'OTHER',
      },
    ];

    const costs = aggregateCosts({ supplierInvoices, expenses });
    assert.equal(money(costs.actualCosts).toFixed(0), '120000');

    const overview = computeProjectOverview({
      contractValue: '500000',
      currentBudget: '380000',
      actualCosts: costs.actualCosts,
      committedCosts: costs.committedCosts,
      revenueReceived: '200000',
      outstandingRevenue: '50000',
    });

    assert.equal(money(overview.revenueReceived).toFixed(0), '200000');
    assert.equal(money(overview.actualCosts).toFixed(0), '120000');
    assert.equal(money(overview.currentProfit).toFixed(0), '80000');
    assert.equal(money(overview.outstandingRevenue).toFixed(0), '50000');
    assert.equal(money(overview.remainingBudget).toFixed(0), '260000');

    const afterPartial = applyPaymentToInvoice({
      currentStatus: 'OPEN',
      grossAmount: '250000',
      paidAmount: '0',
      paymentAmount: '200000',
      dueDate: new Date('2026-12-31T12:00:00.000Z'),
    });
    assert.equal(money(afterPartial.newPaidAmount).toFixed(0), '200000');
    assert.equal(remainingBalance('250000', afterPartial.newPaidAmount).toFixed(0), '50000');
    assert.equal(afterPartial.status, 'PARTIALLY_PAID');
  });
});
