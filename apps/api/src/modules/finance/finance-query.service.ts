import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { aggregateCosts, money } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Scalable finance reads — prefer Prisma aggregate/groupBy, then map through
 * the canonical cost policy (invoice-wins) for actual costs.
 *
 * Optional `projectIds`:
 * - `null` (default) = company-wide (no project filter)
 * - `string[]` = restrict to those project ids (empty → empty/zero results)
 */
@Injectable()
export class FinanceQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private projectIdFilter(
    projectIds: string[] | null,
  ): { projectId: { in: string[] } } | Record<string, never> {
    if (projectIds === null) return {};
    return { projectId: { in: projectIds } };
  }

  private paymentScope(projectIds: string[] | null): Prisma.PaymentWhereInput {
    if (projectIds === null) return {};
    return {
      OR: [
        { projectId: { in: projectIds } },
        { invoice: { is: { projectId: { in: projectIds } } } },
      ],
    };
  }

  async loadCostRows(projectId?: string, projectIds: string[] | null = null) {
    const projectFilter = projectId
      ? { projectId }
      : this.projectIdFilter(projectIds);

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
          projectId: true,
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
          projectId: true,
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
        projectId: row.projectId,
      })),
      supplierInvoices: supplierInvoices.map((row) => ({
        status: row.status,
        grossAmount: row.grossAmount.toString(),
        paidAmount: row.paidAmount.toString(),
        invoiceNumber: row.invoiceNumber,
        supplierId: row.supplierId,
        projectId: row.projectId,
      })),
    };
  }

  async companyCostTotals(projectIds: string[] | null = null) {
    const rows = await this.loadCostRows(undefined, projectIds);
    return aggregateCosts(rows);
  }

  async projectCostTotals(projectId: string) {
    const rows = await this.loadCostRows(projectId);
    return aggregateCosts(rows);
  }

  async customerRevenuePaid(
    projectIds: string[] | null = null,
  ): Promise<string> {
    const result = await this.prisma.invoice.aggregate({
      where: {
        deletedAt: null,
        type: 'CUSTOMER',
        status: { notIn: ['CANCELLED', 'DRAFT'] },
        ...this.projectIdFilter(projectIds),
      },
      _sum: { paidAmount: true },
    });
    return (result._sum.paidAmount ?? money(0)).toDecimalPlaces(4).toFixed(4);
  }

  async outstandingByType(
    type: 'CUSTOMER' | 'SUPPLIER',
    projectIds: string[] | null = null,
  ): Promise<string> {
    // Sum remaining balance in SQL — avoids loading all open invoices into memory.
    if (projectIds !== null && projectIds.length === 0) {
      return money(0).toDecimalPlaces(4).toFixed(4);
    }

    const rows =
      projectIds === null
        ? await this.prisma.$queryRaw<Array<{ outstanding: string }>>`
            SELECT COALESCE(SUM(GREATEST("grossAmount" - "paidAmount", 0)), 0)::text AS outstanding
            FROM "invoices"
            WHERE "deletedAt" IS NULL
              AND "type" = ${type}::"InvoiceType"
              AND "status" IN ('SENT', 'OPEN', 'PARTIALLY_PAID', 'OVERDUE')
          `
        : await this.prisma.$queryRaw<Array<{ outstanding: string }>>`
            SELECT COALESCE(SUM(GREATEST("grossAmount" - "paidAmount", 0)), 0)::text AS outstanding
            FROM "invoices"
            WHERE "deletedAt" IS NULL
              AND "type" = ${type}::"InvoiceType"
              AND "status" IN ('SENT', 'OPEN', 'PARTIALLY_PAID', 'OVERDUE')
              AND "projectId" IN (${Prisma.join(projectIds)})
          `;
    return money(rows[0]?.outstanding ?? 0)
      .toDecimalPlaces(4)
      .toFixed(4);
  }

  async projectKpis(projectIds: string[] | null = null) {
    const projectWhere: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(projectIds === null ? {} : { id: { in: projectIds } }),
    };

    const [activeCount, valueAgg, budgetAgg] = await Promise.all([
      this.prisma.project.count({
        where: { ...projectWhere, status: 'ACTIVE' },
      }),
      this.prisma.project.aggregate({
        where: projectWhere,
        _sum: { contractValue: true },
      }),
      this.prisma.project.aggregate({
        where: projectWhere,
        _sum: { currentBudget: true },
      }),
    ]);

    return {
      activeProjects: activeCount,
      totalProjectValue: (valueAgg._sum.contractValue ?? money(0))
        .toDecimalPlaces(4)
        .toFixed(4),
      totalBudget: (budgetAgg._sum.currentBudget ?? money(0))
        .toDecimalPlaces(4)
        .toFixed(4),
    };
  }

  async cashFlowTotals(projectIds: string[] | null = null) {
    const scope = this.paymentScope(projectIds);
    const [incoming, outgoing] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { deletedAt: null, type: 'INCOMING', ...scope },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { deletedAt: null, type: 'OUTGOING', ...scope },
        _sum: { amount: true },
      }),
    ]);
    const cashIn = money(incoming._sum.amount ?? 0);
    const cashOut = money(outgoing._sum.amount ?? 0);
    return {
      cashIn: cashIn.toDecimalPlaces(4).toFixed(4),
      cashOut: cashOut.toDecimalPlaces(4).toFixed(4),
      availableCash: cashIn.minus(cashOut).toDecimalPlaces(4).toFixed(4),
    };
  }

  /**
   * Monthly cash totals — select only needed payment columns (no nested entity loads).
   */
  async monthlyCashFlow(months: string[], projectIds: string[] | null = null) {
    const payments = await this.prisma.payment.findMany({
      where: { deletedAt: null, ...this.paymentScope(projectIds) },
      select: { amount: true, type: true, paymentDate: true },
    });

    const map = new Map(
      months.map((m) => [m, { cashIn: money(0), cashOut: money(0) }]),
    );
    for (const payment of payments) {
      const d = payment.paymentDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = map.get(key);
      if (!bucket) continue;
      if (payment.type === 'INCOMING') {
        bucket.cashIn = bucket.cashIn.plus(payment.amount);
      } else {
        bucket.cashOut = bucket.cashOut.plus(payment.amount);
      }
    }

    return months.map((month) => {
      const b = map.get(month)!;
      return {
        month,
        inflow: b.cashIn.toDecimalPlaces(4).toFixed(4),
        outflow: b.cashOut.toDecimalPlaces(4).toFixed(4),
        net: b.cashIn.minus(b.cashOut).toDecimalPlaces(4).toFixed(4),
      };
    });
  }

  async invoiceStatusDistribution(projectIds: string[] | null = null) {
    const groups = await this.prisma.invoice.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        ...this.projectIdFilter(projectIds),
      },
      _count: { _all: true },
    });
    return groups.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
  }

  async projectProfitabilityRows(projectIds: string[] | null = null) {
    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(projectIds === null ? {} : { id: { in: projectIds } }),
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true,
        contractValue: true,
        currentBudget: true,
      },
      orderBy: { projectNumber: 'asc' },
    });

    const [customerPaid, costRows] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['projectId'],
        where: {
          deletedAt: null,
          type: 'CUSTOMER',
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          projectId: projectIds === null ? { not: null } : { in: projectIds },
        },
        _sum: { paidAmount: true },
      }),
      this.loadCostRows(undefined, projectIds),
    ]);

    const revenueByProject = new Map(
      customerPaid.map((row) => [
        row.projectId!,
        money(row._sum.paidAmount ?? 0),
      ]),
    );

    return projects.map((project) => {
      const revenue = revenueByProject.get(project.id) ?? money(0);
      const costs = aggregateCosts({
        supplierInvoices: costRows.supplierInvoices.filter(
          (row) => row.projectId === project.id,
        ),
        expenses: costRows.expenses.filter(
          (row) => row.projectId === project.id,
        ),
      });
      const costMoney = money(costs.actualCosts);
      const profit = revenue.minus(costMoney);
      const profitMarginPercent = revenue.isZero()
        ? null
        : profit.div(revenue).mul(100).toDecimalPlaces(2).toFixed(2);

      return {
        projectId: project.id,
        projectNumber: project.projectNumber,
        name: project.name,
        status: project.status,
        revenue: revenue.toDecimalPlaces(4).toFixed(4),
        costs: costs.actualCosts,
        committedCosts: costs.committedCosts,
        profit: profit.toDecimalPlaces(4).toFixed(4),
        profitMarginPercent,
        contractValue: project.contractValue.toString(),
        currentBudget: project.currentBudget.toString(),
      };
    });
  }
}
