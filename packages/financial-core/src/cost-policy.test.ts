import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateCosts,
  aggregateSupplierSpend,
  expenseDuplicatesSupplierInvoice,
  buildSupplierInvoiceNumberSet,
} from './cost-policy';

const sharedScenario = {
  supplierInvoices: [
    {
      invoiceNumber: 'ER-100',
      status: 'PAID',
      grossAmount: '119.0000',
      paidAmount: '119.0000',
      supplierId: 'sup-1',
    },
  ],
  expenses: [
    {
      invoiceNumber: 'ER-100',
      status: 'PAID',
      category: 'MATERIALS',
      grossAmount: '119.0000',
      paidAmount: '119.0000',
      supplierId: 'sup-1',
    },
    {
      invoiceNumber: null,
      status: 'PAID',
      category: 'OTHER',
      grossAmount: '50.0000',
      paidAmount: '50.0000',
      supplierId: 'sup-1',
    },
  ],
};

describe('cost policy — invoice wins over duplicate expense', () => {
  it('counts matching expense+invoice cost only once', () => {
    const result = aggregateCosts(sharedScenario);

    assert.equal(result.actualCosts, '169.0000');
    assert.equal(result.byCategory.OTHER.actual, '169.0000');
  });

  it('keeps project, supplier, and company actuals identical for same rows', () => {
    const project = aggregateCosts(sharedScenario);
    const company = aggregateCosts(sharedScenario);
    const supplier = aggregateSupplierSpend(sharedScenario);

    assert.equal(project.actualCosts, company.actualCosts);
    assert.equal(project.actualCosts, supplier.paidAmount);
    assert.equal(supplier.totalPurchases, '169.0000');
  });

  it('detects duplicate invoice numbers case-insensitively', () => {
    const keys = buildSupplierInvoiceNumberSet([
      { invoiceNumber: 'Er-100', status: 'OPEN' },
    ]);
    assert.equal(expenseDuplicatesSupplierInvoice('er-100', keys), true);
    assert.equal(expenseDuplicatesSupplierInvoice('other', keys), false);
  });

  it('ignores cancelled/draft supplier invoices for matching set', () => {
    const keys = buildSupplierInvoiceNumberSet([
      { invoiceNumber: 'X-1', status: 'DRAFT' },
      { invoiceNumber: 'X-2', status: 'CANCELLED' },
      { invoiceNumber: 'X-3', status: 'OPEN' },
    ]);
    assert.equal(keys.has('x-1'), false);
    assert.equal(keys.has('x-3'), true);
  });
});
