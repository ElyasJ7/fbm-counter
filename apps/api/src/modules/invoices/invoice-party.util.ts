import { BadRequestException } from '@nestjs/common';
import { InvoiceType } from '@prisma/client';

/** Extracted for unit testing without spinning Prisma. */
export async function assertCustomerInvoiceParty(
  type: InvoiceType,
  customerId?: string | null,
  findCustomer?: (id: string) => Promise<{ id: string } | null>,
) {
  if (type !== InvoiceType.CUSTOMER) return;
  if (!customerId) {
    throw new BadRequestException(
      'customerId is required for CUSTOMER invoices',
    );
  }
  if (findCustomer) {
    const customer = await findCustomer(customerId);
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
  }
}

export async function assertSupplierInvoiceParty(
  type: InvoiceType,
  supplierId?: string | null,
  subcontractorId?: string | null,
) {
  if (type !== InvoiceType.SUPPLIER) return;
  if (!supplierId && !subcontractorId) {
    throw new BadRequestException(
      'supplierId or subcontractorId is required for SUPPLIER invoices',
    );
  }
}
