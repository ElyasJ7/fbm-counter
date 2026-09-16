import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { money } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';

const OPEN_INVOICE_STATUSES = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

const OPEN_EXPENSE_STATUSES = [
  'PENDING',
  'APPROVED',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

type MoneyTotals = {
  totalPurchases: string;
  paidAmount: string;
  outstandingBalance: string;
};

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  private moneyStr(value: ReturnType<typeof money>) {
    return value.toDecimalPlaces(4).toFixed(4);
  }

  private summarizeSupplier(
    invoices: Array<{
      status: string;
      grossAmount: Prisma.Decimal;
      paidAmount: Prisma.Decimal;
    }>,
    expenses: Array<{
      status: string;
      grossAmount: Prisma.Decimal;
      paidAmount: Prisma.Decimal;
    }>,
  ): MoneyTotals {
    let totalPurchases = money(0);
    let paidAmount = money(0);
    let outstandingBalance = money(0);

    for (const invoice of invoices) {
      totalPurchases = totalPurchases.plus(invoice.grossAmount);
      paidAmount = paidAmount.plus(invoice.paidAmount);
      const remaining = money(invoice.grossAmount).minus(invoice.paidAmount);
      if (
        remaining.greaterThan(0) &&
        OPEN_INVOICE_STATUSES.includes(
          invoice.status as (typeof OPEN_INVOICE_STATUSES)[number],
        )
      ) {
        outstandingBalance = outstandingBalance.plus(remaining);
      }
    }

    for (const expense of expenses) {
      totalPurchases = totalPurchases.plus(expense.grossAmount);
      paidAmount = paidAmount.plus(expense.paidAmount);
      const remaining = money(expense.grossAmount).minus(expense.paidAmount);
      if (
        remaining.greaterThan(0) &&
        OPEN_EXPENSE_STATUSES.includes(
          expense.status as (typeof OPEN_EXPENSE_STATUSES)[number],
        )
      ) {
        outstandingBalance = outstandingBalance.plus(remaining);
      }
    }

    return {
      totalPurchases: this.moneyStr(totalPurchases),
      paidAmount: this.moneyStr(paidAmount),
      outstandingBalance: this.moneyStr(outstandingBalance),
    };
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { contactPerson: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { companyName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const supplierIds = data.map((s) => s.id);
    if (supplierIds.length === 0) {
      return {
        data: [],
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
    }

    const [invoices, expenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          supplierId: { in: supplierIds },
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: {
          supplierId: true,
          status: true,
          grossAmount: true,
          paidAmount: true,
        },
      }),
      this.prisma.expense.findMany({
        where: {
          supplierId: { in: supplierIds },
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: {
          supplierId: true,
          status: true,
          grossAmount: true,
          paidAmount: true,
        },
      }),
    ]);

    const invoicesBySupplier = new Map<string, typeof invoices>();
    for (const invoice of invoices) {
      if (!invoice.supplierId) continue;
      const list = invoicesBySupplier.get(invoice.supplierId) ?? [];
      list.push(invoice);
      invoicesBySupplier.set(invoice.supplierId, list);
    }

    const expensesBySupplier = new Map<string, typeof expenses>();
    for (const expense of expenses) {
      if (!expense.supplierId) continue;
      const list = expensesBySupplier.get(expense.supplierId) ?? [];
      list.push(expense);
      expensesBySupplier.set(expense.supplierId, list);
    }

    return {
      data: data.map((supplier) => ({
        ...supplier,
        totals: this.summarizeSupplier(
          invoicesBySupplier.get(supplier.id) ?? [],
          expensesBySupplier.get(supplier.id) ?? [],
        ),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const [invoices, expenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { supplierId: id, deletedAt: null },
        orderBy: { issueDate: 'desc' },
        take: 20,
        include: {
          project: { select: { id: true, name: true, projectNumber: true } },
        },
      }),
      this.prisma.expense.findMany({
        where: { supplierId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          project: { select: { id: true, name: true, projectNumber: true } },
        },
      }),
    ]);

    // Totals from all non-cancelled records (not just the recent page)
    const [allInvoices, allExpenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          supplierId: id,
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: { status: true, grossAmount: true, paidAmount: true },
      }),
      this.prisma.expense.findMany({
        where: {
          supplierId: id,
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: { status: true, grossAmount: true, paidAmount: true },
      }),
    ]);

    const projectsMap = new Map<
      string,
      { id: string; name: string; projectNumber: string }
    >();
    for (const invoice of invoices) {
      if (invoice.project) {
        projectsMap.set(invoice.project.id, invoice.project);
      }
    }
    for (const expense of expenses) {
      if (expense.project) {
        projectsMap.set(expense.project.id, expense.project);
      }
    }

    return {
      ...supplier,
      totals: this.summarizeSupplier(allInvoices, allExpenses),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        status: invoice.status,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        netAmount: invoice.netAmount.toString(),
        grossAmount: invoice.grossAmount.toString(),
        paidAmount: invoice.paidAmount.toString(),
        projectId: invoice.projectId,
        project: invoice.project,
      })),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        expenseNumber: expense.expenseNumber,
        status: expense.status,
        description: expense.description,
        invoiceDate: expense.invoiceDate?.toISOString() ?? null,
        dueDate: expense.dueDate?.toISOString() ?? null,
        netAmount: expense.netAmount.toString(),
        grossAmount: expense.grossAmount.toString(),
        paidAmount: expense.paidAmount.toString(),
        projectId: expense.projectId,
        project: expense.project,
      })),
      projects: Array.from(projectsMap.values()),
    };
  }

  create(dto: CreateSupplierDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          email: dto.email,
          phone: dto.phone,
          street: dto.street,
          postalCode: dto.postalCode,
          city: dto.city,
          country: dto.country ?? 'DE',
          vatId: dto.vatId,
          taxNumber: dto.taxNumber,
          iban: dto.iban,
          paymentTerms: dto.paymentTerms,
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUPPLIER_CREATED',
          entityType: 'Supplier',
          entityId: supplier.id,
          newValue: {
            companyName: supplier.companyName,
          },
        },
      });

      return supplier;
    });
  }

  async update(id: string, dto: UpdateSupplierDto, actorId: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Supplier not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { id },
        data: {
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          email: dto.email,
          phone: dto.phone,
          street: dto.street,
          postalCode: dto.postalCode,
          city: dto.city,
          country: dto.country,
          vatId: dto.vatId,
          taxNumber: dto.taxNumber,
          iban: dto.iban,
          paymentTerms: dto.paymentTerms,
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUPPLIER_UPDATED',
          entityType: 'Supplier',
          entityId: id,
          previousValue: { companyName: existing.companyName },
          newValue: { companyName: supplier.companyName },
        },
      });

      return supplier;
    });
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Supplier not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUPPLIER_DELETED',
          entityType: 'Supplier',
          entityId: id,
          previousValue: { companyName: existing.companyName },
        },
      });
    });

    return { success: true };
  }
}
