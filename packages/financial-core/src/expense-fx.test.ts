import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  expenseAmountForProjectCurrency,
  snapshotExpenseFx,
} from './expense-fx';

describe('expense FX snapshot', () => {
  it('converts AFN expense to USD with frozen rate', () => {
    const snap = snapshotExpenseFx({
      currency: 'AFN',
      grossAmount: '70000',
      usdToAfnRate: '70',
    });
    assert.equal(snap.amountUsd, '1000.0000');
    assert.equal(snap.amountAfn, '70000.0000');
    assert.equal(snap.usdToAfnRate, '70.00000000');
  });

  it('converts USD expense to AFN with frozen rate', () => {
    const snap = snapshotExpenseFx({
      currency: 'USD',
      grossAmount: '2000',
      usdToAfnRate: '70',
    });
    assert.equal(snap.amountUsd, '2000.0000');
    assert.equal(snap.amountAfn, '140000.0000');
  });

  it('keeps historical AFN→USD booking when picking project currency', () => {
    const booked = expenseAmountForProjectCurrency({
      projectCurrency: 'USD',
      currency: 'AFN',
      grossAmount: '70000',
      paidAmount: '70000',
      amountUsd: '1000.0000',
      amountAfn: '70000.0000',
    });
    assert.equal(booked.grossAmount, '1000.0000');
    assert.equal(booked.paidAmount, '1000.0000');
  });

  it('uses USD amount directly for USD project budgets', () => {
    const booked = expenseAmountForProjectCurrency({
      projectCurrency: 'USD',
      currency: 'USD',
      grossAmount: '3000',
      paidAmount: '3000',
      amountUsd: '3000.0000',
      amountAfn: '210000.0000',
    });
    assert.equal(booked.grossAmount, '3000.0000');
  });
});
