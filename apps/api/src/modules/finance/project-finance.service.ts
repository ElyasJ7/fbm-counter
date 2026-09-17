import { Injectable } from '@nestjs/common';
import {
  aggregateCosts,
  computeProjectOverview,
  money,
} from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_INVOICE_STATUSES = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

@Injectable()
export class ProjectFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Load cost rows for a project (or company-wide when projectId omitted). */
  async loadCostRows(projectId?: string) {
    const projectFilter = projectId ? { projectId } : {};

    const [expenses, supplierInvoices] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          ...projectFilter,
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: {
          status: true,
          grossAmount: true,
          paidAmount: true,
          invoiceNumber: true,
          category: true,
          supplierId: true,
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          ...projectFilter,
          deletedAt: null,
          type: 'SUPPLIER',
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        select: {
          status: true,
          grossAmount: true,
          paidAmount: true,
          invoiceNumber: true,
          supplierId: true,
        },
      }),
    ]);

    return {
      expenses: expenses.map((row) => ({
        status: row.status,
        grossAmount: row.grossAmount.toString(),
        paidAmount: row.paidAmount.toString(),
        invoiceNumber: row.invoiceNumber,
        category: row.category,
        supplierId: row.supplierId,
      })),
      supplierInvoices: supplierInvoices.map((row) => ({
        status: row.status,
        grossAmount: row.grossAmount.toString(),
        paidAmount: row.paidAmount.toString(),
        invoiceNumber: row.invoiceNumber,
        supplierId: row.supplierId,
      })),
    };
  }

  async getOverviewTotals(projectId: string) {
    const { expenses, supplierInvoices } = await this.loadCostRows(projectId);

    const customerInvoices = await this.prisma.invoice.findMany({
      where: {
        projectId,
        deletedAt: null,
        type: 'CUSTOMER',
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      select: {
        status: true,
        grossAmount: true,
        paidAmount: true,
      },
    });

    const costs = aggregateCosts({ expenses, supplierInvoices });

    let revenueReceived = money(0);
    let outstandingRevenue = money(0);
    for (const invoice of customerInvoices) {
      revenueReceived = revenueReceived.plus(invoice.paidAmount);
      const remaining = money(invoice.grossAmount).minus(invoice.paidAmount);
      if (
        remaining.greaterThan(0) &&
        OPEN_INVOICE_STATUSES.includes(
          invoice.status as (typeof OPEN_INVOICE_STATUSES)[number],
        )
      ) {
        outstandingRevenue = outstandingRevenue.plus(remaining);
      }
    }

    const hasFinance =
      expenses.length > 0 ||
      supplierInvoices.length > 0 ||
      customerInvoices.length > 0;

    return {
      actualCosts: costs.actualCosts,
      committedCosts: costs.committedCosts,
      accountsPayable: costs.accountsPayable,
      byCategory: costs.byCategory,
      revenueReceived: revenueReceived.toFixed(4),
      outstandingRevenue: outstandingRevenue.toFixed(4),
      financeDataAvailable: hasFinance,
    };
  }

  async getOverview(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      return null;
    }

    const totals = await this.getOverviewTotals(projectId);
    return computeProjectOverview({
      contractValue: project.contractValue.toString(),
      currentBudget: project.currentBudget.toString(),
      actualCosts: totals.actualCosts,
      committedCosts: totals.committedCosts,
      revenueReceived: totals.revenueReceived,
      outstandingRevenue: totals.outstandingRevenue,
      currency: project.currency,
      financeDataAvailable: totals.financeDataAvailable,
    });
  }
}
