import { BadRequestException, Injectable } from '@nestjs/common';
import { aggregateCosts, money } from '@fbm/financial-core';
import type { BudgetCategory } from '@prisma/client';
import { buildPdfBuffer } from '../common/pdf.util';
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
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private moneyStr(value: ReturnType<typeof money>) {
    return value.toDecimalPlaces(4).toFixed(4);
  }

  private monthKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private formatDateLocal(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseDateBoundary(
    value: string | undefined,
    endOfDay: boolean,
  ): Date | undefined {
    if (!value?.trim()) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new BadRequestException(`Invalid date "${value}". Use YYYY-MM-DD.`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date "${value}".`);
    }
    return date;
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

  private csvEscape(value: string | number | null | undefined) {
    const raw = value == null ? '' : String(value);
    if (/[;"\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }

  private toCsv(rows: string[][]) {
    const bom = '\uFEFF';
    const body = rows
      .map((row) => row.map((cell) => this.csvEscape(cell)).join(';'))
      .join('\r\n');
    return `${bom}${body}\r\n`;
  }

  async getSummary(query: ReportQuery = {}) {
    const { from, to } = this.resolvePeriod(query);

    const [projects, customerInvoices, supplierInvoices, expenses, payments] =
      await Promise.all([
        this.prisma.project.findMany({
          where: { deletedAt: null },
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
            issueDate: true,
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
          where: {
            deletedAt: null,
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

    return {
      currency: 'EUR',
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
    };
  }

  async exportCsv(
    type: 'summary' | 'profitability' | 'cashflow',
    query: ReportQuery = {},
  ) {
    const summary = await this.getSummary(query);
    const currency = summary.currency;

    if (type === 'cashflow') {
      const rows = [
        ['Monat', 'Eingänge', 'Ausgänge', 'Netto', 'Währung'],
        ...summary.monthlyCashFlow.map((row) => [
          row.month,
          row.inflow,
          row.outflow,
          row.net,
          currency,
        ]),
      ];
      return {
        filename: `cashflow-${summary.period.from ?? 'all'}-${summary.period.to ?? 'all'}.csv`,
        content: this.toCsv(rows),
      };
    }

    if (type === 'profitability') {
      const rows = [
        [
          'Projektnummer',
          'Name',
          'Status',
          'Erlös',
          'Kosten',
          'Gewinn',
          'Marge_%',
          'Auftragswert',
          'Budget',
          'Währung',
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
          currency,
        ]),
      ];
      return {
        filename: `profitability-${summary.period.from ?? 'all'}-${summary.period.to ?? 'all'}.csv`,
        content: this.toCsv(rows),
      };
    }

    const rows = [
      ['Kennzahl', 'Wert', 'Währung'],
      ['Gesamterlös', summary.kpis.totalRevenue, currency],
      ['Gesamtausgaben', summary.kpis.totalExpenses, currency],
      ['Bruttogewinn', summary.kpis.grossProfit, currency],
      ['Nettogewinn', summary.kpis.netProfit, currency],
      ['Verfügbare Liquidität', summary.kpis.availableCash, currency],
      [
        'Offene Kundenforderungen',
        summary.kpis.outstandingCustomerInvoices,
        currency,
      ],
      [
        'Offene Lieferantenverbindlichkeiten',
        summary.kpis.outstandingSupplierInvoices,
        currency,
      ],
      ['Aktive Projekte', String(summary.kpis.activeProjects), ''],
      ['Auftragswert gesamt', summary.kpis.totalProjectValue, currency],
      ['Budget gesamt', summary.kpis.totalBudget, currency],
      ['Budgetauslastung_%', summary.kpis.budgetUtilizationPercent ?? '', ''],
      [],
      ['Monat', 'Eingänge', 'Ausgänge', 'Netto', 'Währung'],
      ...summary.monthlyCashFlow.map((row) => [
        row.month,
        row.inflow,
        row.outflow,
        row.net,
        currency,
      ]),
      [],
      [
        'Projektnummer',
        'Name',
        'Status',
        'Erlös',
        'Kosten',
        'Gewinn',
        'Marge_%',
        'Auftragswert',
        'Budget',
        'Währung',
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
        currency,
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
  ) {
    const summary = await this.getSummary(query);
    const buffer = await buildPdfBuffer((doc) => {
      doc.fontSize(18).text('FBM Counter Bericht');
      doc
        .fontSize(10)
        .fillColor('#555')
        .text(
          `Zeitraum: ${summary.period.from ?? 'alle'} – ${summary.period.to ?? 'alle'}`,
        );
      doc.text(`Erstellt: ${summary.generatedAt}`);
      doc.moveDown();

      if (type === 'summary' || type === 'cashflow') {
        doc.fillColor('#000').fontSize(12).text('Kennzahlen');
        doc.fontSize(10);
        doc.text(
          `Gesamterlös: ${summary.kpis.totalRevenue} ${summary.currency}`,
        );
        doc.text(
          `Gesamtausgaben: ${summary.kpis.totalExpenses} ${summary.currency}`,
        );
        doc.text(
          `Bruttogewinn: ${summary.kpis.grossProfit} ${summary.currency}`,
        );
        doc.text(
          `Liquidität: ${summary.kpis.availableCash} ${summary.currency}`,
        );
        doc.moveDown();
        doc.fontSize(12).text('Cashflow');
        doc.fontSize(10);
        for (const row of summary.monthlyCashFlow) {
          doc.text(
            `${row.month}: +${row.inflow} / -${row.outflow} = ${row.net}`,
          );
        }
      }

      if (type === 'summary' || type === 'profitability') {
        doc.moveDown();
        doc.fillColor('#000').fontSize(12).text('Projektrentabilität');
        doc.fontSize(10);
        for (const row of summary.projectProfitability) {
          doc.text(
            `${row.projectNumber} ${row.name}: Gewinn ${row.profit} ${summary.currency}`,
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
