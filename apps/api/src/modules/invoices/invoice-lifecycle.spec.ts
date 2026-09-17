import assert from 'node:assert/strict';
import {
  assertInvoiceDeletable,
  assertInvoiceFinancialEditAllowed,
  collectAttemptedFinancialFields,
  isInvoiceFinanciallyLocked,
} from './invoice-lifecycle';

describe('invoice lifecycle guards', () => {
  it('allows financial edits on DRAFT except paidAmount', () => {
    assert.equal(isInvoiceFinanciallyLocked('DRAFT'), false);
    assert.doesNotThrow(() =>
      assertInvoiceFinancialEditAllowed('DRAFT', { netAmount: '100' }),
    );
    assert.throws(
      () => assertInvoiceFinancialEditAllowed('DRAFT', { paidAmount: '10' }),
      /paidAmount cannot be set directly/,
    );
  });

  it('rejects financial edits on paid and partially paid invoices', () => {
    assert.throws(
      () =>
        assertInvoiceFinancialEditAllowed('PAID', {
          netAmount: '200',
          customerId: 'c1',
        }),
      /Cannot modify financial fields/,
    );
    assert.throws(
      () =>
        assertInvoiceFinancialEditAllowed('PARTIALLY_PAID', {
          taxRate: '19',
        }),
      /Cannot modify financial fields/,
    );
  });

  it('rejects financial edits on issued open invoices', () => {
    assert.throws(
      () => assertInvoiceFinancialEditAllowed('OPEN', { type: 'SUPPLIER' }),
      /Cannot modify financial fields/,
    );
    assert.doesNotThrow(() =>
      assertInvoiceFinancialEditAllowed('OPEN', { notes: 'follow up' }),
    );
  });

  it('blocks silent deletion when payments exist', () => {
    assert.throws(
      () => assertInvoiceDeletable({ status: 'OPEN', paymentCount: 1 }),
      /Cannot delete invoice with payments/,
    );
    assert.doesNotThrow(() =>
      assertInvoiceDeletable({ status: 'DRAFT', paymentCount: 0 }),
    );
  });

  it('collects only defined financial fields', () => {
    assert.deepEqual(
      collectAttemptedFinancialFields({
        netAmount: '1',
        notes: 'x',
        paidAmount: undefined,
      }),
      ['netAmount'],
    );
  });
});
