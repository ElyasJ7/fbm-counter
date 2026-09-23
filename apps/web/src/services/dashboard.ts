import type { MoneyConversionStatus } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export type DashboardProjectProfitability = {
  projectId: string;
  projectNumber: string;
  name: string;
  status: string;
  revenue: string;
  costs: string;
  committedCosts: string;
  profit: string;
  profitMarginPercent: string | null;
  contractValue: string;
  currentBudget: string;
};

export type DashboardFxMeta = {
  status: MoneyConversionStatus;
  baseCurrency: string;
  displayCurrency: string;
  exchangeRate: string | null;
  effectiveAt: string | null;
  fetchedAt: string | null;
  provider: string | null;
};

export type DashboardResponse = {
  /** Amounts are labeled in this currency (books currency if FX unavailable). */
  currency: string;
  baseCurrency: string;
  displayCurrency: string;
  fx: DashboardFxMeta;
  generatedAt: string;
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
    budgetUtilizationPercent: string | null;
    totalBudget: string;
  };
  comparisons: {
    previousPeriodAvailable: boolean;
    note: string;
  };
  charts: {
    revenueVsExpenses: Array<{
      month: string;
      revenue: string;
      expenses: string;
    }>;
    monthlyCashFlow: Array<{
      month: string;
      inflow: string;
      outflow: string;
      net: string;
    }>;
    profitDevelopment: Array<{
      month: string;
      cumulativeProfit: string;
    }>;
    projectProfitability: DashboardProjectProfitability[];
    expensesByCategory: Array<{
      category: string;
      amount: string;
    }>;
    budgetVsActual: {
      planned: string;
      actual: string;
      variance: string;
    };
    invoiceStatusDistribution: Array<{
      status: string;
      count: number;
    }>;
    projectStatusDistribution: Array<{
      status: string;
      count: number;
    }>;
  };
};

export function fetchDashboard(currency?: string) {
  const params = new URLSearchParams();
  if (currency) params.set('currency', currency);
  const qs = params.toString();
  return apiRequest<DashboardResponse>(
    `/dashboard${qs ? `?${qs}` : ''}`,
  );
}
