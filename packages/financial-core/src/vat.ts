import { Decimal, money } from './money';

/**
 * Canonical invoice VAT policy (application-level, not tax-law advice):
 *
 * - Invoices use a **single header taxRate**.
 * - VAT is computed at **invoice-total (header) level** from header netAmount.
 * - Line items store net only; they do not carry independent VAT amounts.
 * - When line items exist, sum(line.net) must equal header netAmount (4 dp).
 * - taxAmount = round_half_up(net * rate / 100, 2)
 * - grossAmount = round_half_up(net + tax, 2)
 * - Mixed VAT rates on one invoice are not supported.
 */

export type InvoiceLineNet = {
  netAmount: string | number | Decimal;
};

export type InvoiceVatResult = {
  netAmount: string;
  taxRate: string;
  taxAmount: string;
  grossAmount: string;
};

export function sumLineNets(lines: InvoiceLineNet[]): Decimal {
  return lines.reduce(
    (acc, line) => acc.plus(money(line.netAmount)),
    money(0),
  );
}

export function computeHeaderVat(
  netAmount: string | number | Decimal,
  taxRatePercent: string | number | Decimal,
): InvoiceVatResult {
  const net = money(netAmount).toDecimalPlaces(4);
  const rate = money(taxRatePercent).toDecimalPlaces(2);
  const taxAmount = net.mul(rate).div(100).toDecimalPlaces(2);
  const grossAmount = net.plus(taxAmount).toDecimalPlaces(2);
  return {
    netAmount: net.toFixed(4),
    taxRate: rate.toFixed(2),
    taxAmount: taxAmount.toFixed(4),
    grossAmount: grossAmount.toFixed(4),
  };
}

/**
 * Reconcile header net with optional line nets, then compute header VAT.
 * Throws Error when line sum and header net disagree beyond 0.0001.
 */
export function reconcileInvoiceTotals(input: {
  netAmount: string | number | Decimal;
  taxRatePercent: string | number | Decimal;
  lines?: InvoiceLineNet[];
}): InvoiceVatResult {
  const headerNet = money(input.netAmount).toDecimalPlaces(4);
  if (input.lines && input.lines.length > 0) {
    const lineSum = sumLineNets(input.lines).toDecimalPlaces(4);
    if (!lineSum.eq(headerNet)) {
      throw new Error(
        `Invoice line net sum (${lineSum.toFixed(4)}) does not match header net (${headerNet.toFixed(4)})`,
      );
    }
  }
  return computeHeaderVat(headerNet, input.taxRatePercent);
}

export function assertNetPlusVatEqualsGross(result: InvoiceVatResult): void {
  const net = money(result.netAmount);
  const tax = money(result.taxAmount);
  const gross = money(result.grossAmount);
  const recomputed = net.plus(tax).toDecimalPlaces(2);
  if (!recomputed.eq(gross.toDecimalPlaces(2))) {
    throw new Error(
      `net + VAT (${recomputed.toFixed(2)}) does not equal gross (${gross.toFixed(2)})`,
    );
  }
}
