import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { computeProjectOverview, money } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_COST_STATUSES = [
  'PENDING',
  'APPROVED',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

const OPEN_INVOICE_STATUSES = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

@Injectable()
export class ProjectFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverviewTotals(projectId: string) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      select: {
        status: true,
        grossAmount: true,
        paidAmount: true,
      },
    });

    const supplierInvoices = await this.prisma.invoice.findMany({
      where: {
        projectId,
        deletedAt: null,
        type: 'SUPPLIER',
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      select: {
        status: true,
        grossAmount: true,
        paidAmount: true,
      },
    });

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

    let actualCosts = money(0);
    let committedCosts = money(0);

    for (const expense of expenses) {
      actualCosts = actualCosts.plus(expense.paidAmount);
      if (
        OPEN_COST_STATUSES.includes(
          expense.status as (typeof OPEN_COST_STATUSES)[number],
        )
      ) {
        committedCosts = committedCosts.plus(
          money(expense.grossAmount).minus(expense.paidAmount),
        );
      }
    }

    for (const invoice of supplierInvoices) {
      actualCosts = actualCosts.plus(invoice.paidAmount);
      if (
        OPEN_INVOICE_STATUSES.includes(
          invoice.status as (typeof OPEN_INVOICE_STATUSES)[number],
        )
      ) {
        committedCosts = committedCosts.plus(
          money(invoice.grossAmount).minus(invoice.paidAmount),
        );
      }
    }

    let revenueReceived = money(0);
    let outstandingRevenue = money(0);
    for (const invoice of customerInvoices) {
      revenueReceived = revenueReceived.plus(invoice.paidAmount);
      if (
        OPEN_INVOICE_STATUSES.includes(
          invoice.status as (typeof OPEN_INVOICE_STATUSES)[number],
        ) ||
        invoice.status === 'PAID'
      ) {
        // outstanding only for open balances
      }
      const remaining = money(invoice.grossAmount).minus(invoice.paidAmount);
      if (remaining.greaterThan(0) && invoice.status !== 'PAID') {
        outstandingRevenue = outstandingRevenue.plus(remaining);
      }
    }

    const hasFinance =
      expenses.length > 0 ||
      supplierInvoices.length > 0 ||
      customerInvoices.length > 0;

    return {
      actualCosts: actualCosts.toFixed(4),
      committedCosts: committedCosts.toFixed(4),
      revenueReceived: revenueReceived.toFixed(4),
      outstandingRevenue: outstandingRevenue.toFixed(4),
      financeDataAvailable: hasFinance,
    };
  }

  async buildOverview(project: {
    id: string;
    contractValue: Prisma.Decimal;
    currentBudget: Prisma.Decimal;
    currency: string;
  }) {
    const totals = await this.getOverviewTotals(project.id);
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
