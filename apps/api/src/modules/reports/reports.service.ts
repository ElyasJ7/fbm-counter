import { BadRequestException, Injectable } from '@nestjs/common';
import {
  aggregateCosts,
  dateOnlyToUtcEndOfDay,
  dateOnlyToUtcStartOfDay,
  money,
  toCsvDocument,
  toDateOnlyString,
} from '@fbm/financial-core';
import type { BudgetCategory } from '@prisma/client';
import type { AuthUserDto } from '@fbm/shared';
import { ProjectAccessService } from '../authz/project-access.service';
import { buildPdfBuffer } from '../common/pdf.util';
import { DisplayFxService } from '../exchange-rates/display-fx.service';
import { FinanceQueryService } from '../finance/finance-query.service';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_INVOICE_STATUSES = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

export type ReportQuery = {
  from?: string;
  to?: string;
  currency?: string;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeQuery: FinanceQueryService,
    private readonly projectAccess: ProjectAccessService,
    private readonly displayFx: DisplayFxService,
  ) {}

  private moneyStr(value: ReturnType<typeof money>) {
    return value.toDecimalPlaces(4).toFixed(4);
  }

  private monthKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private formatDateLocal(date: Date) {
    return toDateOnlyString(date);
  }

  private parseDateBoundary(
    value: string | undefined,
    endOfDay: boolean,
  ): Date | undefined {
    if (!value?.trim()) return undefined;
    try {
      return endOfDay
        ? dateOnlyToUtcEndOfDay(value)
        : dateOnlyToUtcStartOfDay(value);
    } catch {
      throw new BadRequestException(`Invalid date "${value}". Use YYYY-MM-DD.`);
    }
  }

  private resolvePeriod(query: ReportQuery) {
    const from = this.parseDateBoundary(query.from, false);
    const to = this.parseDateBoundary(query.to, true);
    if (from && to && from > to) {
      throw new BadRequestException('"from" must be on or before "to".');
    }
    return { from, to };
  }

  private monthsBetween(from: Date, to: Date): string[] {
    const keys: string[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      keys.push(this.monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
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

  private inPeriod(date: Date, from?: Date, to?: Date) {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  private toCsv(rows: Array<Array<string | number | null | undefined>>) {
    return toCsvDocument(rows);
  }

  private async applyDisplayFx<
    T extends {
      kpis: {
        totalRevenue: string;
        totalExpenses: string;
        grossProfit: string;
        netProfit: string;
        availableCash: string;
        outstandingCustomerInvoices: string;
        outstandingSupplierInvoices: string;
        activeProjects: number;
        totalProjectValue: string;
        totalBudget: string;
        budgetUtilizationPercent: string | null;
      };
      monthlyCashFlow: Array<{
        month: string;
        inflow: string;
        outflow: string;
        net: string;
      }>;
      projectProfitability: Array<{
        projectId: string;
        projectNumber: string;
        name: string;
        status: string;
        revenue: string;
        costs: string;
        profit: string;
        profitMarginPercent: string | null;
        contractValue: string;
        currentBudget: string;
      }>;
      expensesByCategory: Array<{ category: BudgetCategory; amount: string }>;
      generatedAt: string;
      period: { from: string | null; to: string | null };
    },
  >(raw: T, user: AuthUserDto, queryCurrency?: string) {
    const { baseCurrency, displayCurrency } =
      await this.displayFx.resolveCurrencies(user, queryCurrency);

    const moneySlots: string[] = [
      raw.kpis.totalRevenue,
      raw.kpis.totalExpenses,
      raw.kpis.grossProfit,
      raw.kpis.netProfit,
      raw.kpis.availableCash,
      raw.kpis.outstandingCustomerInvoices,
      raw.kpis.outstandingSupplierInvoices,
      raw.kpis.totalProjectValue,
      raw.kpis.totalBudget,
    ];
    for (const row of raw.monthlyCashFlow) {
      moneySlots.push(row.inflow, row.outflow, row.net);
    }
    for (const row of raw.projectProfitability) {
      moneySlots.push(
        row.revenue,
        row.costs,
        row.profit,
        row.contractValue,
        row.currentBudget,
      );
    }
    for (const row of raw.expensesByCategory) {
      moneySlots.push(row.amount);
    }

    const { amounts: converted, fx } = await this.displayFx.convertMoneyFields(
      moneySlots,
      baseCurrency,
      displayCurrency,
    );
    const labeledCurrency = this.displayFx.labeledCurrency(fx);

    let i = 0;
    const take = () => converted[i++];

    return {
      currency: labeledCurrency,
      baseCurrency,
      displayCurrency,
      fx,
      generatedAt: raw.generatedAt,
      period: raw.period,
      kpis: {
        totalRevenue: take(),
        totalExpenses: take(),
        grossProfit: take(),
        netProfit: take(),
        availableCash: take(),
        outstandingCustomerInvoices: take(),
        outstandingSupplierInvoices: take(),
        activeProjects: raw.kpis.activeProjects,
        totalProjectValue: take(),
        totalBudget: take(),
        budgetUtilizationPercent: raw.kpis.budgetUtilizationPercent,
      },
      monthlyCashFlow: raw.monthlyCashFlow.map((row) => ({
        month: row.month,
        inflow: take(),
        outflow: take(),
        net: take(),
      })),
      projectProfitability: raw.projectProfitability.map((row) => ({
        ...row,
        revenue: take(),
        costs: take(),
        profit: take(),
        contractValue: take(),
        currentBudget: take(),
      })),
      expensesByCategory: raw.expensesByCategory.map((row) => ({
        category: row.category,
        amount: take(),
      })),
    };
  }

  private fxCsvMeta(summary: {
    baseCurrency: string;
    displayCurrency: string;
    currency: string;
    fx: {
      status: string;
      exchangeRate: string | null;
      effectiveAt: string | null;
      fetchedAt: string | null;
    };
  }) {
    return [
      ['Reporting Currency', summary.currency],
      ['Books Currency', summary.baseCurrency],
      ['Display Currency', summary.displayCurrency],
      ['FX Status', summary.fx.status],
      ['Exchange Rate', summary.fx.exchangeRate ?? ''],
      ['Rate Effective At', summary.fx.effectiveAt ?? ''],
      ['Rate Fetched At', summary.fx.fetchedAt ?? ''],
      [],
    ];
  }

  async getSummary(query: ReportQuery = {}, user: AuthUserDto) {
    const { from, to } = this.resolvePeriod(query);
    const projectIds = await this.projectAccess.accessibleProjectIds(user);

    // Unscoped path: reuse scalable finance query service (same cost policy).
    if (!from && !to) {
      const [
        totalRevenue,
        costs,
        outstandingCustomer,
        outstandingSupplier,
        projectKpis,
        cash,
        months,
        projectProfitability,
      ] = await Promise.all([
        this.financeQuery.customerRevenuePaid(projectIds),
        this.financeQuery.companyCostTotals(projectIds),
        this.financeQuery.outstandingByType('CUSTOMER', projectIds),
        this.financeQuery.outstandingByType('SUPPLIER', projectIds),
        this.financeQuery.projectKpis(projectIds),
        this.financeQuery.cashFlowTotals(projectIds),
        Promise.resolve(this.lastNMonths(12)),
        this.financeQuery.projectProfitabilityRows(projectIds),
      ]);
      const monthlyCashFlow = await this.financeQuery.monthlyCashFlow(
        months,
        projectIds,
      );
      const totalBudget = money(projectKpis.totalBudget);
      const totalExpensePaid = money(costs.actualCosts);
      const budgetUtilizationPercent = totalBudget.isZero()
        ? null
        : totalExpensePaid
            .div(totalBudget)
            .mul(100)
            .toDecimalPlaces(2)
            .toFixed(2);

      const expensesByCategory = Object.entries(costs.byCategory)
        .map(([category, amounts]) => ({
          category: category as BudgetCategory,
          amount: amounts.actual,
        }))
        .filter((row) => !money(row.amount).isZero())
        .sort((a, b) => money(b.amount).comparedTo(money(a.amount)));

      const sorted = [...projectProfitability].sort((a, b) =>
        money(b.profit).comparedTo(money(a.profit)),
      );

      return this.applyDisplayFx(
        {
          generatedAt: new Date().toISOString(),
          period: { from: null, to: null },
          kpis: {
            totalRevenue,
            totalExpenses: costs.actualCosts,
            grossProfit: money(totalRevenue)
              .minus(totalExpensePaid)
              .toDecimalPlaces(4)
              .toFixed(4),
            netProfit: money(totalRevenue)
              .minus(totalExpensePaid)
              .toDecimalPlaces(4)
              .toFixed(4),
            availableCash: cash.availableCash,
            outstandingCustomerInvoices: outstandingCustomer,
            outstandingSupplierInvoices: outstandingSupplier,
            activeProjects: projectKpis.activeProjects,
            totalProjectValue: projectKpis.totalProjectValue,
            totalBudget: projectKpis.totalBudget,
            budgetUtilizationPercent,
          },
          monthlyCashFlow,
          projectProfitability: sorted,
          expensesByCategory,
        },
        user,
        query.currency,
      );
    }

    const [projects, customerInvoices, supplierInvoices, expenses, payments] =
      await Promise.all([
        this.prisma.project.findMany({
          where: {
            deletedAt: null,
            AND: [this.projectAccess.projectWhere(user)],
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
        }),
        this.prisma.invoice.findMany({
          where: {
            deletedAt: null,
            type: 'CUSTOMER',
            status: { notIn: ['CANCELLED', 'DRAFT'] },
            AND: [this.projectAccess.invoiceWhere(user)],
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
            AND: [this.projectAccess.invoiceWhere(user)],
          },
          select: {
            projectId: true,
            status: true,
            grossAmount: true,
            paidAmount: true,
            issueDate: true,
            invoiceNumber: true,
          },
        }),
        this.prisma.expense.findMany({
          where: {
            deletedAt: null,
            status: { not: 'CANCELLED' },
            AND: [this.projectAccess.expenseWhere(user)],
          },
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
          where: {
            deletedAt: null,
            AND: [this.projectAccess.paymentWhere(user)],
            ...(from || to
              ? {
                  paymentDate: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          select: {
            amount: true,
            type: true,
            paymentDate: true,
            projectId: true,
          },
          orderBy: { paymentDate: 'asc' },
        }),
      ]);

    const periodCustomerInvoices = customerInvoices.filter((inv) =>
      this.inPeriod(inv.issueDate, from, to),
    );
    const periodSupplierInvoices = supplierInvoices.filter((inv) =>
      this.inPeriod(inv.issueDate, from, to),
    );
    const periodExpenses = expenses.filter((expense) =>
      this.inPeriod(expense.invoiceDate ?? expense.createdAt, from, to),
    );

    let totalRevenue = money(0);
    let outstandingCustomer = money(0);
    for (const inv of periodCustomerInvoices) {
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

    const periodCosts = aggregateCosts({
      supplierInvoices: periodSupplierInvoices.map((inv) => ({
        status: inv.status,
        grossAmount: inv.grossAmount.toString(),
        paidAmount: inv.paidAmount.toString(),
        invoiceNumber: inv.invoiceNumber,
      })),
      expenses: periodExpenses.map((expense) => ({
        status: expense.status,
        grossAmount: expense.grossAmount.toString(),
        paidAmount: expense.paidAmount.toString(),
        invoiceNumber: expense.invoiceNumber,
        category: expense.category,
      })),
    });
    const totalExpensePaid = money(periodCosts.actualCosts);
    const outstandingSupplier = money(periodCosts.accountsPayable);

    const grossProfit = totalRevenue.minus(totalExpensePaid);
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

    const months =
      from && to ? this.monthsBetween(from, to) : this.lastNMonths(12);

    const monthlyMap = new Map(
      months.map((key) => [key, { cashIn: money(0), cashOut: money(0) }]),
    );

    for (const payment of payments) {
      const key = this.monthKey(payment.paymentDate);
      const bucket = monthlyMap.get(key);
      if (!bucket) continue;
      if (payment.type === 'INCOMING') {
        bucket.cashIn = bucket.cashIn.plus(payment.amount);
      } else {
        bucket.cashOut = bucket.cashOut.plus(payment.amount);
      }
    }

    const monthlyCashFlow = months.map((month) => {
      const b = monthlyMap.get(month)!;
      return {
        month,
        inflow: this.moneyStr(b.cashIn),
        outflow: this.moneyStr(b.cashOut),
        net: this.moneyStr(b.cashIn.minus(b.cashOut)),
      };
    });

    const projectProfitability = projects.map((project) => {
      let revenue = money(0);
      for (const inv of periodCustomerInvoices) {
        if (inv.projectId === project.id)
          revenue = revenue.plus(inv.paidAmount);
      }
      const projectCosts = aggregateCosts({
        supplierInvoices: periodSupplierInvoices
          .filter((inv) => inv.projectId === project.id)
          .map((inv) => ({
            status: inv.status,
            grossAmount: inv.grossAmount.toString(),
            paidAmount: inv.paidAmount.toString(),
            invoiceNumber: inv.invoiceNumber,
          })),
        expenses: periodExpenses
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
      const profit = revenue.minus(costs);
      const profitMarginPercent = revenue.isZero()
        ? null
        : profit.div(revenue).mul(100).toDecimalPlaces(2).toFixed(2);

      return {
        projectId: project.id,
        projectNumber: project.projectNumber,
        name: project.name,
        status: project.status,
        revenue: this.moneyStr(revenue),
        costs: this.moneyStr(costs),
        profit: this.moneyStr(profit),
        profitMarginPercent,
        contractValue: project.contractValue.toString(),
        currentBudget: project.currentBudget.toString(),
      };
    });

    projectProfitability.sort((a, b) =>
      money(b.profit).comparedTo(money(a.profit)),
    );

    const expensesByCategory = Object.entries(periodCosts.byCategory)
      .map(([category, amounts]) => ({
        category: category as BudgetCategory,
        amount: amounts.actual,
      }))
      .filter((row) => !money(row.amount).isZero())
      .sort((a, b) => money(b.amount).comparedTo(money(a.amount)));

    return this.applyDisplayFx(
      {
        generatedAt: new Date().toISOString(),
        period: {
          from: from ? this.formatDateLocal(from) : null,
          to: to ? this.formatDateLocal(to) : null,
        },
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
          totalBudget: this.moneyStr(totalBudget),
          budgetUtilizationPercent,
        },
        monthlyCashFlow,
        projectProfitability,
        expensesByCategory,
      },
      user,
      query.currency,
    );
  }

  async exportCsv(
    type: 'summary' | 'profitability' | 'cashflow',
    query: ReportQuery = {},
    user: AuthUserDto,
  ) {
    const summary = await this.getSummary(query, user);
    const currency = summary.currency;
    const meta = this.fxCsvMeta(summary);
    const moneyHeaders = [
      'Currency',
      'Books Currency',
      'Reporting Currency',
      'Exchange Rate',
      'Rate Date',
    ] as const;
    const moneyMeta = [
      currency,
      summary.baseCurrency,
      summary.displayCurrency,
      summary.fx.exchangeRate ?? '',
      summary.fx.fetchedAt ?? summary.fx.effectiveAt ?? '',
    ];

    if (type === 'cashflow') {
      const rows = [
        ...meta,
        ['Month', 'Inflows', 'Outflows', 'Net', ...moneyHeaders],
        ...summary.monthlyCashFlow.map((row) => [
          row.month,
          row.inflow,
          row.outflow,
          row.net,
          ...moneyMeta,
        ]),
      ];
      return {
        filename: `cashflow-${summary.period.from ?? 'all'}-${summary.period.to ?? 'all'}.csv`,
        content: this.toCsv(rows),
      };
    }

    if (type === 'profitability') {
      const rows = [
        ...meta,
        [
          'Project Number',
          'Name',
          'Status',
          'Cash Received',
          'Costs',
          'Profit',
          'Margin_%',
          'Contract Value',
          'Budget',
          ...moneyHeaders,
        ],
        ...summary.projectProfitability.map((row) => [
          row.projectNumber,
          row.name,
          row.status,
          row.revenue,
          row.costs,
          row.profit,
          row.profitMarginPercent ?? '',
          row.contractValue,
          row.currentBudget,
          ...moneyMeta,
        ]),
      ];
      return {
        filename: `profitability-${summary.period.from ?? 'all'}-${summary.period.to ?? 'all'}.csv`,
        content: this.toCsv(rows),
      };
    }

    const rows = [
      ...meta,
      ['Metric', 'Value', ...moneyHeaders],
      ['Cash Received', summary.kpis.totalRevenue, ...moneyMeta],
      ['Total Expenses', summary.kpis.totalExpenses, ...moneyMeta],
      ['Gross Profit', summary.kpis.grossProfit, ...moneyMeta],
      ['Net Profit', summary.kpis.netProfit, ...moneyMeta],
      ['Available Cash', summary.kpis.availableCash, ...moneyMeta],
      [
        'Accounts Receivable',
        summary.kpis.outstandingCustomerInvoices,
        ...moneyMeta,
      ],
      [
        'Accounts Payable',
        summary.kpis.outstandingSupplierInvoices,
        ...moneyMeta,
      ],
      [
        'Active Projects',
        String(summary.kpis.activeProjects),
        '',
        '',
        '',
        '',
        '',
      ],
      ['Total Contract Value', summary.kpis.totalProjectValue, ...moneyMeta],
      ['Total Budget', summary.kpis.totalBudget, ...moneyMeta],
      [
        'Budget Utilization_%',
        summary.kpis.budgetUtilizationPercent ?? '',
        '',
        '',
        '',
        '',
        '',
      ],
      [],
      ['Month', 'Inflows', 'Outflows', 'Net', ...moneyHeaders],
      ...summary.monthlyCashFlow.map((row) => [
        row.month,
        row.inflow,
        row.outflow,
        row.net,
        ...moneyMeta,
      ]),
      [],
      [
        'Project Number',
        'Name',
        'Status',
        'Cash Received',
        'Costs',
        'Profit',
        'Margin_%',
        'Contract Value',
        'Budget',
        ...moneyHeaders,
      ],
      ...summary.projectProfitability.map((row) => [
        row.projectNumber,
        row.name,
        row.status,
        row.revenue,
        row.costs,
        row.profit,
        row.profitMarginPercent ?? '',
        row.contractValue,
        row.currentBudget,
        ...moneyMeta,
      ]),
    ];

    return {
      filename: `report-summary-${summary.period.from ?? 'all'}-${summary.period.to ?? 'all'}.csv`,
      content: this.toCsv(rows),
    };
  }

  async exportPdf(
    type: 'summary' | 'profitability' | 'cashflow',
    query: ReportQuery = {},
    user: AuthUserDto,
  ) {
    const summary = await this.getSummary(query, user);
    const buffer = await buildPdfBuffer((doc) => {
      doc.fontSize(18).text('FBM Counter Report');
      doc
        .fontSize(10)
        .fillColor('#555')
        .text(
          `Period: ${summary.period.from ?? 'all'} – ${summary.period.to ?? 'all'}`,
        );
      doc.text(`Generated: ${summary.generatedAt}`);
      doc.text(`Reporting currency: ${summary.currency}`);
      doc.text(`Books currency: ${summary.baseCurrency}`);
      if (summary.fx.status === 'converted' && summary.fx.exchangeRate) {
        doc.text(
          `FX: 1 ${summary.baseCurrency} = ${summary.fx.exchangeRate} ${summary.displayCurrency}` +
            (summary.fx.fetchedAt ? ` (as of ${summary.fx.fetchedAt})` : ''),
        );
      } else if (summary.fx.status === 'unavailable') {
        doc.text(
          `FX unavailable — amounts shown in books currency (${summary.baseCurrency})`,
        );
      }
      doc.moveDown();

      if (type === 'summary' || type === 'cashflow') {
        doc.fillColor('#000').fontSize(12).text('KPIs');
        doc.fontSize(10);
        doc.text(
          `Cash Received: ${summary.kpis.totalRevenue} ${summary.currency}`,
        );
        doc.text(
          `Total Expenses: ${summary.kpis.totalExpenses} ${summary.currency}`,
        );
        doc.text(
          `Gross Profit: ${summary.kpis.grossProfit} ${summary.currency}`,
        );
        doc.text(
          `Available Cash: ${summary.kpis.availableCash} ${summary.currency}`,
        );
        doc.moveDown();
        doc.fontSize(12).text('Cashflow');
        doc.fontSize(10);
        for (const row of summary.monthlyCashFlow) {
          doc.text(
            `${row.month}: +${row.inflow} / -${row.outflow} = ${row.net} ${summary.currency}`,
          );
        }
      }

      if (type === 'summary' || type === 'profitability') {
        doc.moveDown();
        doc.fillColor('#000').fontSize(12).text('Project Profitability');
        doc.fontSize(10);
        for (const row of summary.projectProfitability) {
          doc.text(
            `${row.projectNumber} ${row.name}: Profit ${row.profit} ${summary.currency}`,
          );
        }
      }
    });

    return {
      filename: `report-${type}-${summary.period.from ?? 'all'}-${summary.period.to ?? 'all'}.pdf`,
      buffer,
    };
  }
}
