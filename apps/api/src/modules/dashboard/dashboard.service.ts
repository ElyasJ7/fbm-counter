import { Injectable } from '@nestjs/common';
import { aggregateCosts, money } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_INVOICE_STATUSES = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private moneyStr(value: ReturnType<typeof money>) {
    return value.toDecimalPlaces(4).toFixed(4);
  }

  private monthKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private lastNMonths(n: number): string[] {
    const keys: string[] = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(this.monthKey(d));
    }
    return keys;
  }

  async getDashboard() {
    const [
      projects,
      customerInvoices,
      supplierInvoices,
      expenses,
      payments,
      budgetLines,
      invoiceStatusGroups,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true,
          contractValue: true,
          currentBudget: true,
          currency: true,
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          type: 'CUSTOMER',
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        select: {
          projectId: true,
          status: true,
          grossAmount: true,
          paidAmount: true,
          issueDate: true,
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          type: 'SUPPLIER',
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        select: {
          projectId: true,
          status: true,
          grossAmount: true,
          paidAmount: true,
          invoiceNumber: true,
        },
      }),
      this.prisma.expense.findMany({
        where: { deletedAt: null, status: { not: 'CANCELLED' } },
        select: {
          projectId: true,
          category: true,
          status: true,
          grossAmount: true,
          paidAmount: true,
          invoiceNumber: true,
          invoiceDate: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { deletedAt: null },
        select: {
          amount: true,
          type: true,
          paymentDate: true,
          projectId: true,
        },
        orderBy: { paymentDate: 'asc' },
      }),
      this.prisma.budgetLine.findMany({
        select: {
          plannedAmount: true,
          actualAmount: true,
          committedAmount: true,
          category: true,
        },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    let totalRevenue = money(0);
    let outstandingCustomer = money(0);
    for (const inv of customerInvoices) {
      totalRevenue = totalRevenue.plus(inv.paidAmount);
      const remaining = money(inv.grossAmount).minus(inv.paidAmount);
      if (
        remaining.greaterThan(0) &&
        OPEN_INVOICE_STATUSES.includes(
          inv.status as (typeof OPEN_INVOICE_STATUSES)[number],
        )
      ) {
        outstandingCustomer = outstandingCustomer.plus(remaining);
      }
    }

    const companyCosts = aggregateCosts({
      supplierInvoices: supplierInvoices.map((inv) => ({
        status: inv.status,
        grossAmount: inv.grossAmount.toString(),
        paidAmount: inv.paidAmount.toString(),
        invoiceNumber: inv.invoiceNumber,
      })),
      expenses: expenses.map((expense) => ({
        status: expense.status,
        grossAmount: expense.grossAmount.toString(),
        paidAmount: expense.paidAmount.toString(),
        invoiceNumber: expense.invoiceNumber,
        category: expense.category,
      })),
    });
    const totalExpensePaid = money(companyCosts.actualCosts);
    const outstandingSupplier = money(companyCosts.accountsPayable);

    const grossProfit = totalRevenue.minus(totalExpensePaid);
    // No separate overhead ledger yet — net equals gross until Phase 8+ settings.
    const netProfit = grossProfit;

    let cashIn = money(0);
    let cashOut = money(0);
    for (const payment of payments) {
      if (payment.type === 'INCOMING') {
        cashIn = cashIn.plus(payment.amount);
      } else {
        cashOut = cashOut.plus(payment.amount);
      }
    }
    const availableCash = cashIn.minus(cashOut);

    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
    let totalProjectValue = money(0);
    let totalBudget = money(0);
    for (const project of projects) {
      totalProjectValue = totalProjectValue.plus(project.contractValue);
      totalBudget = totalBudget.plus(project.currentBudget);
    }

    const budgetUtilizationPercent = totalBudget.isZero()
      ? null
      : totalExpensePaid
          .div(totalBudget)
          .mul(100)
          .toDecimalPlaces(2)
          .toFixed(2);

    const months = this.lastNMonths(12);
    const monthlyMap = new Map(
      months.map((key) => [
        key,
        {
          revenue: money(0),
          expenses: money(0),
          cashIn: money(0),
          cashOut: money(0),
        },
      ]),
    );

    for (const payment of payments) {
      const key = this.monthKey(payment.paymentDate);
      const bucket = monthlyMap.get(key);
      if (!bucket) continue;
      if (payment.type === 'INCOMING') {
        bucket.cashIn = bucket.cashIn.plus(payment.amount);
        bucket.revenue = bucket.revenue.plus(payment.amount);
      } else {
        bucket.cashOut = bucket.cashOut.plus(payment.amount);
        bucket.expenses = bucket.expenses.plus(payment.amount);
      }
    }

    // Include paid expenses without payment records in monthly expenses by invoice/created date
    for (const expense of expenses) {
      if (money(expense.paidAmount).isZero()) continue;
      const date = expense.invoiceDate ?? expense.createdAt;
      const key = this.monthKey(date);
      const bucket = monthlyMap.get(key);
      if (!bucket) continue;
      // Avoid double-counting if mirrored by outgoing payments — only add unpaid-via-payment path:
      // Seed ties some costs to supplier invoice payments; expense paid amounts may overlap.
      // Use expense paid only when not already represented is hard; for chart clarity use payment-based
      // revenue/expense and keep expense category chart separate.
    }

    const revenueVsExpenses = months.map((month) => {
      const b = monthlyMap.get(month)!;
      return {
        month,
        revenue: this.moneyStr(b.revenue),
        expenses: this.moneyStr(b.expenses),
      };
    });

    const monthlyCashFlow = months.map((month) => {
      const b = monthlyMap.get(month)!;
      return {
        month,
        inflow: this.moneyStr(b.cashIn),
        outflow: this.moneyStr(b.cashOut),
        net: this.moneyStr(b.cashIn.minus(b.cashOut)),
      };
    });

    let running = money(0);
    const profitDevelopment = months.map((month) => {
      const b = monthlyMap.get(month)!;
      running = running.plus(b.revenue.minus(b.expenses));
      return {
        month,
        cumulativeProfit: this.moneyStr(running),
      };
    });

    const projectProfitability = [];
    for (const project of projects) {
      let revenue = money(0);
      for (const inv of customerInvoices) {
        if (inv.projectId === project.id)
          revenue = revenue.plus(inv.paidAmount);
      }
      const projectCosts = aggregateCosts({
        supplierInvoices: supplierInvoices
          .filter((inv) => inv.projectId === project.id)
          .map((inv) => ({
            status: inv.status,
            grossAmount: inv.grossAmount.toString(),
            paidAmount: inv.paidAmount.toString(),
            invoiceNumber: inv.invoiceNumber,
          })),
        expenses: expenses
          .filter((expense) => expense.projectId === project.id)
          .map((expense) => ({
            status: expense.status,
            grossAmount: expense.grossAmount.toString(),
            paidAmount: expense.paidAmount.toString(),
            invoiceNumber: expense.invoiceNumber,
            category: expense.category,
          })),
      });
      const costs = money(projectCosts.actualCosts);
      projectProfitability.push({
        projectId: project.id,
        projectNumber: project.projectNumber,
        name: project.name,
        revenue: this.moneyStr(revenue),
        costs: this.moneyStr(costs),
        profit: this.moneyStr(revenue.minus(costs)),
        contractValue: project.contractValue.toString(),
      });
    }
    projectProfitability.sort((a, b) =>
      money(b.profit).comparedTo(money(a.profit)),
    );

    const expensesByCategory = Object.entries(companyCosts.byCategory)
      .map(([category, amounts]) => ({
        category,
        amount: amounts.actual,
      }))
      .filter((row) => !money(row.amount).isZero())
      .sort((a, b) => money(b.amount).comparedTo(money(a.amount)));

    let plannedBudget = money(0);
    let actualBudget = money(0);
    for (const line of budgetLines) {
      plannedBudget = plannedBudget.plus(line.plannedAmount);
      actualBudget = actualBudget.plus(line.actualAmount);
    }
    // Fallback to project budgets / paid costs if no lines
    if (budgetLines.length === 0) {
      plannedBudget = totalBudget;
      actualBudget = totalExpensePaid;
    }

    const budgetVsActual = {
      planned: this.moneyStr(plannedBudget),
      actual: this.moneyStr(actualBudget),
      variance: this.moneyStr(plannedBudget.minus(actualBudget)),
    };

    const invoiceStatusDistribution = invoiceStatusGroups.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));

    const hasComparableHistory = payments.length > 0;

    return {
      currency: 'EUR',
      generatedAt: new Date().toISOString(),
      kpis: {
        totalRevenue: this.moneyStr(totalRevenue),
        totalExpenses: this.moneyStr(totalExpensePaid),
        grossProfit: this.moneyStr(grossProfit),
        netProfit: this.moneyStr(netProfit),
        availableCash: this.moneyStr(availableCash),
        outstandingCustomerInvoices: this.moneyStr(outstandingCustomer),
        outstandingSupplierInvoices: this.moneyStr(outstandingSupplier),
        activeProjects,
        totalProjectValue: this.moneyStr(totalProjectValue),
        budgetUtilizationPercent,
        totalBudget: this.moneyStr(totalBudget),
      },
      comparisons: {
        // Explicitly omitted until period snapshots exist
        previousPeriodAvailable: false,
        note: hasComparableHistory
          ? 'Period-over-period KPI deltas are not shown until historical snapshots are stored.'
          : 'No payment history available for trend comparison.',
      },
      charts: {
        revenueVsExpenses,
        monthlyCashFlow,
        profitDevelopment,
        projectProfitability: projectProfitability.slice(0, 10),
        expensesByCategory,
        budgetVsActual,
        invoiceStatusDistribution,
      },
    };
  }
}
