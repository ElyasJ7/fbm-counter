import type {
  BudgetCategory,
  BudgetLineDto,
  ExpenseDto,
  ExpenseStatus,
  InvoiceDto,
  InvoiceStatus,
  InvoiceType,
  PaginatedResponse,
  PaymentDto,
  PaymentMethod,
} from '@fbm/shared';
import { apiRequest } from '../lib/api';

export {
  createSupplier,
  deleteSupplier,
  fetchSupplier,
  fetchSuppliers,
  updateSupplier,
  type SupplierInput,
} from './partners';


export type BudgetLineInput = {
  category: BudgetCategory;
  plannedAmount: string;
  committedAmount?: string;
  actualAmount?: string;
  notes?: string;
};

export type ExpenseInput = {
  expenseNumber?: string;
  projectId?: string;
  category?: BudgetCategory;
  supplierId?: string;
  description: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  netAmount: string;
  currency?: string;
  taxRate?: string;
  status?: ExpenseStatus;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
};

export type InvoiceItemInput = {
  description: string;
  quantity?: string;
  unitPrice: string;
  netAmount?: string;
  sortOrder?: number;
};

export type InvoiceInput = {
  invoiceNumber?: string;
  type: InvoiceType;
  projectId?: string;
  customerId?: string;
  supplierId?: string;
  issueDate: string;
  dueDate: string;
  netAmount: string;
  currency?: string;
  taxRate?: string;
  status?: InvoiceStatus;
  paymentTerms?: string;
  notes?: string;
  items?: InvoiceItemInput[];
};

export type PaymentInput = {
  invoiceId: string;
  projectId?: string;
  paymentDate: string;
  amount: string;
  currency?: string;
  method?: PaymentMethod;
  reference?: string;
  bankReference?: string;
  notes?: string;
};

function toQuery(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}

export function fetchProjectBudget(
  projectId: string,
  options?: { sync?: boolean },
) {
  return apiRequest<{ data: BudgetLineDto[] }>(
    `/budgets/projects/${projectId}${toQuery({
      sync: options?.sync ? '1' : undefined,
    })}`,
  );
}

export function saveProjectBudget(projectId: string, lines: BudgetLineInput[]) {
  return apiRequest<{ data: BudgetLineDto[] }>(
    `/budgets/projects/${projectId}`,
    {
      method: 'PUT',
      body: { lines },
    },
  );
}

export function fetchExpenses(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  projectId?: string;
  status?: ExpenseStatus | '';
}) {
  return apiRequest<PaginatedResponse<ExpenseDto>>(
    `/expenses${toQuery(params)}`,
  );
}

export function createExpense(body: ExpenseInput) {
  return apiRequest<ExpenseDto>('/expenses', { method: 'POST', body });
}

export function updateExpense(id: string, body: Partial<ExpenseInput>) {
  return apiRequest<ExpenseDto>(`/expenses/${id}`, {
    method: 'PATCH',
    body,
  });
}

export function approveExpense(id: string) {
  return apiRequest<ExpenseDto>(`/expenses/${id}/approve`, {
    method: 'PATCH',
  });
}

export function deleteExpense(id: string) {
  return apiRequest<{ success: boolean }>(`/expenses/${id}`, {
    method: 'DELETE',
  });
}

export function fetchInvoices(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: InvoiceType | '';
  projectId?: string;
  status?: InvoiceStatus | '';
}) {
  return apiRequest<PaginatedResponse<InvoiceDto>>(
    `/invoices${toQuery(params)}`,
  );
}

export function createInvoice(body: InvoiceInput) {
  return apiRequest<InvoiceDto>('/invoices', { method: 'POST', body });
}

export function updateInvoice(id: string, body: Partial<InvoiceInput>) {
  return apiRequest<InvoiceDto>(`/invoices/${id}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteInvoice(id: string) {
  return apiRequest<{ success: boolean }>(`/invoices/${id}`, {
    method: 'DELETE',
  });
}

export function invoicePdfPath(id: string) {
  return `/invoices/${id}/pdf`;
}

export function fetchPayments(params: {
  page?: number;
  pageSize?: number;
  invoiceId?: string;
  projectId?: string;
}) {
  return apiRequest<PaginatedResponse<PaymentDto>>(
    `/payments${toQuery(params)}`,
  );
}

export function createPayment(body: PaymentInput) {
  return apiRequest<PaymentDto>('/payments', { method: 'POST', body });
}

export function deletePayment(id: string) {
  return apiRequest<{ success: boolean }>(`/payments/${id}`, {
    method: 'DELETE',
  });
}
