import { BadRequestException } from '@nestjs/common';
import { InvoiceType } from '@prisma/client';
import {
  assertCustomerInvoiceParty,
  assertSupplierInvoiceParty,
} from './invoice-party.util';

describe('invoice party validation', () => {
  it('requires customerId for CUSTOMER invoices', async () => {
    await expect(
      assertCustomerInvoiceParty(InvoiceType.CUSTOMER, null),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing customer', async () => {
    await expect(
      assertCustomerInvoiceParty(InvoiceType.CUSTOMER, 'c1', () =>
        Promise.resolve(null),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts existing customer', async () => {
    await expect(
      assertCustomerInvoiceParty(InvoiceType.CUSTOMER, 'c1', () =>
        Promise.resolve({ id: 'c1' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('requires supplier or subcontractor for SUPPLIER invoices', () => {
    expect(() =>
      assertSupplierInvoiceParty(InvoiceType.SUPPLIER, null, null),
    ).toThrow(BadRequestException);
  });

  it('accepts supplierId for SUPPLIER invoices', () => {
    expect(() =>
      assertSupplierInvoiceParty(InvoiceType.SUPPLIER, 's1', null),
    ).not.toThrow();
  });
});
