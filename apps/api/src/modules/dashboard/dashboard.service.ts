import { Injectable } from '@nestjs/common';
import { money } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceQueryService } from '../finance/finance-query.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeQuery: FinanceQueryService,
  ) {}

  private moneyStr(value: ReturnType<typeof money> | string) {
    return money(value).toDecimalPlaces(4).toFixed(4);
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
    const months = this.lastNMonths(12);

    const [
      totalRevenue,
      costs,
      outstandingCustomer,
      outstandingSupplier,
      projectKpis,
      cash,
      monthlyCashFlow,
      projectProfitability,
      invoiceStatusDistribution,
      projectStatusDistribution,
      budgetLines,
      paymentCount,
    ] = await Promise.all([
      this.financeQuery.customerRevenuePaid(),
      this.financeQuery.companyCostTotals(),
      this.financeQuery.outstandingByType('CUSTOMER'),
      this.financeQuery.outstandingByType('SUPPLIER'),
      this.financeQuery.projectKpis(),
      this.financeQuery.cashFlowTotals(),
      this.financeQuery.monthlyCashFlow(months),
      this.financeQuery.projectProfitabilityRows(),
      this.financeQuery.invoiceStatusDistribution(),
      this.prisma.project.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.budgetLine.findMany({
        select: {
          plannedAmount: true,
          actualAmount: true,
        },
      }),
      this.prisma.payment.count({ where: { deletedAt: null } }),
    ]);

    const totalExpensePaid = money(costs.actualCosts);
    const revenue = money(totalRevenue);
    const grossProfit = revenue.minus(totalExpensePaid);
    const netProfit = grossProfit;
    const totalBudget = money(projectKpis.totalBudget);

    const budgetUtilizationPercent = totalBudget.isZero()
      ? null
      : totalExpensePaid
          .div(totalBudget)
          .mul(100)
          .toDecimalPlaces(2)
          .toFixed(2);

    const revenueVsExpenses = monthlyCashFlow.map((row) => ({
      month: row.month,
      revenue: row.inflow,
      expenses: row.outflow,
    }));

    let running = money(0);
    const profitDevelopment = monthlyCashFlow.map((row) => {
      running = running.plus(money(row.inflow).minus(row.outflow));
      return {
        month: row.month,
        cumulativeProfit: this.moneyStr(running),
      };
    });

    const sortedProfitability = [...projectProfitability].sort((a, b) =>
      money(b.profit).comparedTo(money(a.profit)),
    );

    const expensesByCategory = Object.entries(costs.byCategory)
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
    if (budgetLines.length === 0) {
      plannedBudget = totalBudget;
      actualBudget = totalExpensePaid;
    }

    return {
      currency: 'EUR',
      generatedAt: new Date().toISOString(),
      kpis: {
        totalRevenue: this.moneyStr(totalRevenue),
        totalExpenses: this.moneyStr(totalExpensePaid),
        grossProfit: this.moneyStr(grossProfit),
        netProfit: this.moneyStr(netProfit),
        availableCash: cash.availableCash,
        outstandingCustomerInvoices: outstandingCustomer,
        outstandingSupplierInvoices: outstandingSupplier,
        activeProjects: projectKpis.activeProjects,
        totalProjectValue: projectKpis.totalProjectValue,
        budgetUtilizationPercent,
        totalBudget: projectKpis.totalBudget,
      },
      comparisons: {
        previousPeriodAvailable: false,
        note:
          paymentCount > 0
            ? 'Period-over-period KPI deltas are not shown until historical snapshots are stored.'
            : 'No payment history available for trend comparison.',
      },
      charts: {
        revenueVsExpenses,
        monthlyCashFlow,
        profitDevelopment,
        projectProfitability: sortedProfitability.slice(0, 10).map((row) => ({
          projectId: row.projectId,
          projectNumber: row.projectNumber,
          name: row.name,
          status: row.status,
          revenue: row.revenue,
          costs: row.costs,
          committedCosts: row.committedCosts,
          profit: row.profit,
          profitMarginPercent: row.profitMarginPercent,
          contractValue: row.contractValue,
          currentBudget: row.currentBudget,
        })),
        expensesByCategory,
        budgetVsActual: {
          planned: this.moneyStr(plannedBudget),
          actual: this.moneyStr(actualBudget),
          variance: this.moneyStr(plannedBudget.minus(actualBudget)),
        },
        invoiceStatusDistribution,
        projectStatusDistribution: projectStatusDistribution.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
      },
    };
  }
}
