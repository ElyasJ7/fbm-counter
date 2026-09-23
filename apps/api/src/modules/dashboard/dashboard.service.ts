import { Injectable } from '@nestjs/common';
import type { AuthUserDto } from '@fbm/shared';
import { money } from '@fbm/financial-core';
import { ProjectAccessService } from '../authz/project-access.service';
import { DisplayFxService } from '../exchange-rates/display-fx.service';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceQueryService } from '../finance/finance-query.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeQuery: FinanceQueryService,
    private readonly projectAccess: ProjectAccessService,
    private readonly displayFx: DisplayFxService,
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

  async getDashboard(user: AuthUserDto, queryCurrency?: string) {
    const { baseCurrency, displayCurrency } =
      await this.displayFx.resolveCurrencies(user, queryCurrency);

    const months = this.lastNMonths(12);
    const projectIds = await this.projectAccess.accessibleProjectIds(user);

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
      this.financeQuery.customerRevenuePaid(projectIds),
      this.financeQuery.companyCostTotals(projectIds),
      this.financeQuery.outstandingByType('CUSTOMER', projectIds),
      this.financeQuery.outstandingByType('SUPPLIER', projectIds),
      this.financeQuery.projectKpis(projectIds),
      this.financeQuery.cashFlowTotals(projectIds),
      this.financeQuery.monthlyCashFlow(months, projectIds),
      this.financeQuery.projectProfitabilityRows(projectIds),
      this.financeQuery.invoiceStatusDistribution(projectIds),
      this.prisma.project.groupBy({
        by: ['status'],
        where: {
          deletedAt: null,
          ...(projectIds === null ? {} : { id: { in: projectIds } }),
        },
        _count: { _all: true },
      }),
      this.prisma.budgetLine.findMany({
        where: projectIds === null ? {} : { projectId: { in: projectIds } },
        select: {
          plannedAmount: true,
          actualAmount: true,
        },
      }),
      this.prisma.payment.count({
        where: {
          deletedAt: null,
          ...(projectIds === null
            ? {}
            : {
                OR: [
                  { projectId: { in: projectIds } },
                  { invoice: { is: { projectId: { in: projectIds } } } },
                ],
              }),
        },
      }),
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

    const profitabilityRows = sortedProfitability.slice(0, 10).map((row) => ({
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
    }));

    // Flatten all money fields for a single conversion pass (books → display).
    const moneySlots: string[] = [
      this.moneyStr(totalRevenue),
      this.moneyStr(totalExpensePaid),
      this.moneyStr(grossProfit),
      this.moneyStr(netProfit),
      cash.availableCash,
      outstandingCustomer,
      outstandingSupplier,
      projectKpis.totalProjectValue,
      projectKpis.totalBudget,
      this.moneyStr(plannedBudget),
      this.moneyStr(actualBudget),
      this.moneyStr(plannedBudget.minus(actualBudget)),
    ];

    for (const row of revenueVsExpenses) {
      moneySlots.push(row.revenue, row.expenses);
    }
    for (const row of monthlyCashFlow) {
      moneySlots.push(row.inflow, row.outflow, row.net);
    }
    for (const row of profitDevelopment) {
      moneySlots.push(row.cumulativeProfit);
    }
    for (const row of profitabilityRows) {
      moneySlots.push(
        row.revenue,
        row.costs,
        row.committedCosts,
        row.profit,
        row.contractValue,
        row.currentBudget,
      );
    }
    for (const row of expensesByCategory) {
      moneySlots.push(row.amount);
    }

    const { amounts: converted, fx } = await this.displayFx.convertMoneyFields(
      moneySlots,
      baseCurrency,
      displayCurrency,
    );

    const labeledCurrency = this.displayFx.labeledCurrency(fx);

    let i = 0;
    const take = () => converted[i++]!;

    const kpis = {
      totalRevenue: take(),
      totalExpenses: take(),
      grossProfit: take(),
      netProfit: take(),
      availableCash: take(),
      outstandingCustomerInvoices: take(),
      outstandingSupplierInvoices: take(),
      activeProjects: projectKpis.activeProjects,
      totalProjectValue: take(),
      budgetUtilizationPercent,
      totalBudget: take(),
    };

    const budgetVsActual = {
      planned: take(),
      actual: take(),
      variance: take(),
    };

    const convertedRevenueVsExpenses = revenueVsExpenses.map((row) => ({
      month: row.month,
      revenue: take(),
      expenses: take(),
    }));

    const convertedMonthlyCashFlow = monthlyCashFlow.map((row) => ({
      month: row.month,
      inflow: take(),
      outflow: take(),
      net: take(),
    }));

    const convertedProfitDevelopment = profitDevelopment.map((row) => ({
      month: row.month,
      cumulativeProfit: take(),
    }));

    const convertedProfitability = profitabilityRows.map((row) => ({
      ...row,
      revenue: take(),
      costs: take(),
      committedCosts: take(),
      profit: take(),
      contractValue: take(),
      currentBudget: take(),
    }));

    const convertedExpensesByCategory = expensesByCategory.map((row) => ({
      category: row.category,
      amount: take(),
    }));

    return {
      currency: labeledCurrency,
      baseCurrency,
      displayCurrency,
      fx,
      generatedAt: new Date().toISOString(),
      kpis,
      comparisons: {
        previousPeriodAvailable: false,
        note:
          paymentCount > 0
            ? 'Period-over-period KPI deltas are not shown until historical snapshots are stored.'
            : 'No payment history available for trend comparison.',
      },
      charts: {
        revenueVsExpenses: convertedRevenueVsExpenses,
        monthlyCashFlow: convertedMonthlyCashFlow,
        profitDevelopment: convertedProfitDevelopment,
        projectProfitability: convertedProfitability,
        expensesByCategory: convertedExpensesByCategory,
        budgetVsActual,
        invoiceStatusDistribution,
        projectStatusDistribution: projectStatusDistribution.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
      },
    };
  }
}
