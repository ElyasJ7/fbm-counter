import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import {
  calculateGrossAmount,
  calculateTaxAmount,
  money,
  resolveInvoiceStatus,
  type InvoiceStatusName,
} from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInvoiceDto, InvoiceItemDto } from './dto/create-invoice.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';

const invoiceInclude = {
  project: { select: { id: true, projectNumber: true, name: true } },
  customer: { select: { id: true, companyName: true } },
  supplier: { select: { id: true, companyName: true } },
  subcontractor: { select: { id: true, companyName: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  private decimalToString(value: Prisma.Decimal | string | number): string {
    return value.toString();
  }

  private async nextInvoiceNumber(
    type: InvoiceType,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const year = new Date().getFullYear();
    const prefix = type === InvoiceType.CUSTOMER ? `RE-${year}-` : `ER-${year}-`;
    const latest = await tx.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    let seq = 1;
    if (latest) {
      const part = latest.invoiceNumber.split('-').pop();
      seq = (Number(part) || 0) + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private computeTax(netAmount: string, taxRate: string) {
    return {
      taxAmount: calculateTaxAmount(netAmount, taxRate).toFixed(4),
      grossAmount: calculateGrossAmount(netAmount, taxRate).toFixed(4),
    };
  }

  private mapItems(items?: InvoiceItemDto[]) {
    if (!items?.length) return undefined;
    return items.map((item, index) => {
      const quantity = item.quantity ?? '1';
      const netAmount =
        item.netAmount ??
        money(quantity).mul(money(item.unitPrice)).toDecimalPlaces(4).toFixed(4);
      return {
        description: item.description,
        quantity,
        unitPrice: item.unitPrice,
        netAmount,
        sortOrder: item.sortOrder ?? index,
      };
    });
  }

  private serialize(
    invoice: Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>,
  ) {
    const status = resolveInvoiceStatus({
      currentStatus: invoice.status as InvoiceStatusName,
      grossAmount: invoice.grossAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      dueDate: invoice.dueDate,
    });

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      projectId: invoice.projectId,
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      subcontractorId: invoice.subcontractorId,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      netAmount: this.decimalToString(invoice.netAmount),
      taxRate: this.decimalToString(invoice.taxRate),
      taxAmount: this.decimalToString(invoice.taxAmount),
      grossAmount: this.decimalToString(invoice.grossAmount),
      paidAmount: this.decimalToString(invoice.paidAmount),
      status,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      project: invoice.project,
      customer: invoice.customer,
      supplier: invoice.supplier,
      subcontractor: invoice.subcontractor,
      items: invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: this.decimalToString(item.quantity),
        unitPrice: this.decimalToString(item.unitPrice),
        netAmount: this.decimalToString(item.netAmount),
        sortOrder: item.sortOrder,
      })),
    };
  }

  private async validateParty(
    type: InvoiceType,
    customerId?: string | null,
    supplierId?: string | null,
    subcontractorId?: string | null,
  ) {
    if (type === InvoiceType.CUSTOMER) {
      if (!customerId) {
        throw new BadRequestException('customerId is required for CUSTOMER invoices');
      }
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, deletedAt: null },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found');
      }
    }
    if (type === InvoiceType.SUPPLIER) {
      if (!supplierId && !subcontractorId) {
        throw new BadRequestException(
          'supplierId or subcontractorId is required for SUPPLIER invoices',
        );
      }
      if (supplierId) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { id: supplierId, deletedAt: null },
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found');
        }
      }
      if (subcontractorId) {
        const subcontractor = await this.prisma.subcontractor.findFirst({
          where: { id: subcontractorId, deletedAt: null },
        });
        if (!subcontractor) {
          throw new BadRequestException('Subcontractor not found');
        }
      }
    }
  }

  private async assertProject(projectId?: string | null) {
    if (!projectId) return;
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      throw new BadRequestException('Project not found');
    }
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: InvoiceType;
    projectId?: string;
    status?: InvoiceStatus;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(params.type ? { type: params.type } : {}),
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.serialize(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const resolved = resolveInvoiceStatus({
      currentStatus: invoice.status as InvoiceStatusName,
      grossAmount: invoice.grossAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      dueDate: invoice.dueDate,
    });

    if (resolved !== invoice.status) {
      const updated = await this.prisma.invoice.update({
        where: { id },
        data: { status: resolved },
        include: invoiceInclude,
      });
      return this.serialize(updated);
    }

    return this.serialize(invoice);
  }

  async create(dto: CreateInvoiceDto, actorId: string) {
    await this.validateParty(
      dto.type,
      dto.customerId,
      dto.supplierId,
      dto.subcontractorId,
    );
    await this.assertProject(dto.projectId);

    if (dto.invoiceNumber) {
      const clash = await this.prisma.invoice.findFirst({
        where: { invoiceNumber: dto.invoiceNumber },
      });
      if (clash) {
        throw new ConflictException('Invoice number already exists');
      }
    }

    const taxRate = dto.taxRate ?? '19';
    const amounts = this.computeTax(dto.netAmount, taxRate);
    const items = this.mapItems(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber =
        dto.invoiceNumber ?? (await this.nextInvoiceNumber(dto.type, tx));

      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          type: dto.type,
          projectId: dto.projectId,
          customerId:
            dto.type === InvoiceType.CUSTOMER ? dto.customerId : null,
          supplierId:
            dto.type === InvoiceType.SUPPLIER ? (dto.supplierId ?? null) : null,
          subcontractorId:
            dto.type === InvoiceType.SUPPLIER
              ? (dto.subcontractorId ?? null)
              : null,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          netAmount: dto.netAmount,
          taxRate,
          taxAmount: amounts.taxAmount,
          grossAmount: amounts.grossAmount,
          paidAmount: dto.paidAmount ?? '0',
          status: dto.status ?? InvoiceStatus.DRAFT,
          paymentTerms: dto.paymentTerms,
          notes: dto.notes,
          ...(items ? { items: { create: items } } : {}),
        },
        include: invoiceInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'INVOICE_CREATED',
          entityType: 'Invoice',
          entityId: created.id,
          newValue: {
            invoiceNumber: created.invoiceNumber,
            type: created.type,
            status: created.status,
            netAmount: created.netAmount.toString(),
          },
        },
      });

      return this.serialize(created);
    });
  }

  async update(id: string, dto: UpdateInvoiceDto, actorId: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    const type = dto.type ?? existing.type;
    const customerId =
      dto.customerId !== undefined ? dto.customerId : existing.customerId;
    const supplierId =
      dto.supplierId !== undefined ? dto.supplierId : existing.supplierId;
    const subcontractorId =
      dto.subcontractorId !== undefined
        ? dto.subcontractorId
        : existing.subcontractorId;

    await this.validateParty(type, customerId, supplierId, subcontractorId);
    if (dto.projectId !== undefined) {
      await this.assertProject(dto.projectId);
    }

    if (dto.invoiceNumber && dto.invoiceNumber !== existing.invoiceNumber) {
      const clash = await this.prisma.invoice.findFirst({
        where: { invoiceNumber: dto.invoiceNumber, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException('Invoice number already exists');
      }
    }

    const netAmount = dto.netAmount ?? existing.netAmount.toString();
    const taxRate = dto.taxRate ?? existing.taxRate.toString();
    const amounts =
      dto.netAmount !== undefined || dto.taxRate !== undefined
        ? this.computeTax(netAmount, taxRate)
        : {
            taxAmount: existing.taxAmount.toString(),
            grossAmount: existing.grossAmount.toString(),
          };

    const paidAmount = dto.paidAmount ?? existing.paidAmount.toString();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : existing.dueDate;
    const requestedStatus = dto.status ?? existing.status;
    const status = resolveInvoiceStatus({
      currentStatus: requestedStatus as InvoiceStatusName,
      grossAmount: amounts.grossAmount,
      paidAmount,
      dueDate,
    });

    const items = this.mapItems(dto.items);

    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: dto.invoiceNumber,
          type: dto.type,
          projectId: dto.projectId,
          customerId:
            type === InvoiceType.CUSTOMER
              ? customerId
              : dto.type
                ? null
                : undefined,
          supplierId:
            type === InvoiceType.SUPPLIER
              ? supplierId
              : dto.type
                ? null
                : undefined,
          subcontractorId:
            type === InvoiceType.SUPPLIER
              ? subcontractorId
              : dto.type
                ? null
                : undefined,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          netAmount: dto.netAmount,
          taxRate: dto.taxRate,
          taxAmount: amounts.taxAmount,
          grossAmount: amounts.grossAmount,
          paidAmount: dto.paidAmount,
          status,
          paymentTerms: dto.paymentTerms,
          notes: dto.notes,
          ...(items ? { items: { create: items } } : {}),
        },
        include: invoiceInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'INVOICE_UPDATED',
          entityType: 'Invoice',
          entityId: id,
          previousValue: {
            invoiceNumber: existing.invoiceNumber,
            status: existing.status,
            netAmount: existing.netAmount.toString(),
          },
          newValue: {
            invoiceNumber: updated.invoiceNumber,
            status: updated.status,
            netAmount: updated.netAmount.toString(),
          },
        },
      });

      return this.serialize(updated);
    });
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'INVOICE_DELETED',
          entityType: 'Invoice',
          entityId: id,
          previousValue: {
            invoiceNumber: existing.invoiceNumber,
            status: existing.status,
          },
        },
      });
    });

    return { success: true };
  }
}
