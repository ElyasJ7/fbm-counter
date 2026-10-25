import { asMoneyString, money, type Decimal } from './money';

/**
 * Dual-currency expense booking (AFN ↔ USD).
 * Rate convention: `usdToAfnRate` = AFN per 1 USD (e.g. 70 means 1 USD = 70 AFN).
 * Snapshots are frozen at expense create/update time and must not follow later rate changes.
 */
export type ExpenseFxSnapshot = {
  usdToAfnRate: string;
  amountUsd: string;
  amountAfn: string;
};

export function snapshotExpenseFx(input: {
  currency: string;
  grossAmount: string | number | Decimal;
  /** AFN per 1 USD */
  usdToAfnRate: string | number | Decimal;
}): ExpenseFxSnapshot {
  const rate = money(input.usdToAfnRate);
  if (!rate.isFinite() || rate.lte(0)) {
    throw new Error('USD→AFN rate must be a positive number');
  }
  const gross = money(input.grossAmount);
  const code = String(input.currency || '').trim().toUpperCase();

  const frozenRate = rate.toDecimalPlaces(8).toFixed(8);

  if (code === 'USD') {
    return {
      usdToAfnRate: frozenRate,
      amountUsd: asMoneyString(gross),
      amountAfn: asMoneyString(gross.mul(rate)),
    };
  }

  if (code === 'AFN') {
    return {
      usdToAfnRate: frozenRate,
      amountAfn: asMoneyString(gross),
      amountUsd: asMoneyString(gross.div(rate)),
    };
  }

  throw new Error(`Unsupported expense currency "${input.currency}"`);
}

/** Pick the frozen dual-currency amount for a project books currency. */
export function expenseAmountForProjectCurrency(input: {
  projectCurrency: string;
  currency: string;
  grossAmount: string | number | Decimal;
  paidAmount: string | number | Decimal;
  amountUsd?: string | number | Decimal | null;
  amountAfn?: string | number | Decimal | null;
}): { grossAmount: string; paidAmount: string } {
  const target = String(input.projectCurrency || '').trim().toUpperCase();
  const source = String(input.currency || '').trim().toUpperCase();

  let bookedGross: Decimal | null = null;
  if (target === 'USD' && input.amountUsd != null && input.amountUsd !== '') {
    bookedGross = money(input.amountUsd);
  } else if (
    target === 'AFN' &&
    input.amountAfn != null &&
    input.amountAfn !== ''
  ) {
    bookedGross = money(input.amountAfn);
  } else if (source === target) {
    bookedGross = money(input.grossAmount);
  } else {
    // Legacy rows without a snapshot: fall back to native gross (may mix currencies).
    bookedGross = money(input.grossAmount);
  }

  const nativeGross = money(input.grossAmount);
  const nativePaid = money(input.paidAmount);
  const paidRatio = nativeGross.isZero()
    ? money(0)
    : nativePaid.div(nativeGross);
  const bookedPaid = bookedGross.mul(paidRatio);

  return {
    grossAmount: asMoneyString(bookedGross),
    paidAmount: asMoneyString(bookedPaid),
  };
}
