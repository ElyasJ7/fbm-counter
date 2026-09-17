export const ROLES = [
  'ADMIN',
  'MANAGEMENT',
  'ACCOUNTING',
  'PROJECT_MANAGER',
  'VIEWER',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'users:read',
  'users:write',
  'projects:read',
  'projects:write',
  'projects:delete',
  'finances:read',
  'finances:write',
  'finances:approve',
  'invoices:read',
  'invoices:write',
  'payments:read',
  'payments:write',
  'expenses:read',
  'expenses:write',
  'suppliers:read',
  'suppliers:write',
  'subcontractors:read',
  'subcontractors:write',
  'documents:read',
  'documents:write',
  'reports:read',
  'reports:export',
  'settings:read',
  'settings:write',
  'audit:read',
  'notifications:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [...PERMISSIONS],
  MANAGEMENT: [
    'projects:read',
    'finances:read',
    'finances:approve',
    'invoices:read',
    'payments:read',
    'expenses:read',
    'suppliers:read',
    'subcontractors:read',
    'documents:read',
    'reports:read',
    'reports:export',
    'notifications:read',
    'audit:read',
    'settings:read',
  ],
  ACCOUNTING: [
    'projects:read',
    'finances:read',
    'finances:write',
    'finances:approve',
    'invoices:read',
    'invoices:write',
    'payments:read',
    'payments:write',
    'expenses:read',
    'expenses:write',
    'suppliers:read',
    'suppliers:write',
    'subcontractors:read',
    'documents:read',
    'documents:write',
    'reports:read',
    'reports:export',
    'notifications:read',
  ],
  PROJECT_MANAGER: [
    'projects:read',
    'projects:write',
    'finances:read',
    'expenses:read',
    'expenses:write',
    'invoices:read',
    'payments:read',
    'suppliers:read',
    'subcontractors:read',
    'subcontractors:write',
    'documents:read',
    'documents:write',
    'reports:read',
    'notifications:read',
  ],
  VIEWER: [
    'projects:read',
    'finances:read',
    'invoices:read',
    'payments:read',
    'expenses:read',
    'suppliers:read',
    'subcontractors:read',
    'documents:read',
    'reports:read',
    'notifications:read',
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const GERMAN_VAT_RATES = {
  standard: 19,
  reduced: 7,
  zero: 0,
} as const;

export const DEFAULT_CURRENCY = 'EUR' as const;

export const APP_NAME = 'FBM Counter';
export const APP_COMPANY_PLACEHOLDER = 'Muster Bau GmbH';

export type AuthUserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
};

export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
};

export const PROJECT_STATUSES = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CustomerDto = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  vatId: string | null;
  taxNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
};

export type ProjectListItemDto = {
  id: string;
  projectNumber: string;
  name: string;
  status: ProjectStatus;
  contractValue: string;
  currentBudget: string;
  currency: string;
  progressPercent: number;
  startDate: string | null;
  expectedCompletionDate: string | null;
  customer: {
    id: string;
    companyName: string;
  };
  projectManager: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type ProjectDetailDto = ProjectListItemDto & {
  description: string | null;
  customerContact: string | null;
  siteStreet: string | null;
  sitePostalCode: string | null;
  siteCity: string | null;
  siteCountry: string;
  actualCompletionDate: string | null;
  initialBudget: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: CustomerDto;
  overview: ProjectOverviewDto;
};

export type ProjectOverviewDto = {
  contractValue: string;
  budget: string;
  actualCosts: string;
  committedCosts: string;
  revenueReceived: string;
  outstandingRevenue: string;
  currentProfit: string;
  projectedProfit: string;
  profitMarginPercent: string | null;
  remainingBudget: string;
  currency: string;
  financeDataAvailable: boolean;
};

export const BUDGET_CATEGORIES = [
  'MATERIALS',
  'LABOR',
  'SUBCONTRACTORS',
  'EQUIPMENT',
  'TRANSPORTATION',
  'PERMITS',
  'INSURANCE',
  'PROFESSIONAL_SERVICES',
  'OTHER',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  MATERIALS: 'Materialien',
  LABOR: 'Arbeitskräfte',
  SUBCONTRACTORS: 'Nachunternehmer',
  EQUIPMENT: 'Geräte',
  TRANSPORTATION: 'Transport',
  PERMITS: 'Genehmigungen',
  INSURANCE: 'Versicherung',
  PROFESSIONAL_SERVICES: 'Freie Leistungen',
  OTHER: 'Sonstiges',
};

export const EXPENSE_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Entwurf',
  PENDING: 'Ausstehend',
  APPROVED: 'Freigegeben',
  PARTIALLY_PAID: 'Teilweise bezahlt',
  PAID: 'Bezahlt',
  OVERDUE: 'Überfällig',
  CANCELLED: 'Storniert',
};

export const INVOICE_TYPES = ['CUSTOMER', 'SUPPLIER'] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  CUSTOMER: 'Ausgangsrechnung',
  SUPPLIER: 'Eingangsrechnung',
};

export const INVOICE_STATUSES = [
  'DRAFT',
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Entwurf',
  SENT: 'Gesendet',
  OPEN: 'Offen',
  PARTIALLY_PAID: 'Teilweise bezahlt',
  PAID: 'Bezahlt',
  OVERDUE: 'Überfällig',
  CANCELLED: 'Storniert',
};

export const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'CASH',
  'CREDIT_CARD',
  'DIRECT_DEBIT',
  'OTHER',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Überweisung',
  CASH: 'Bar',
  CREDIT_CARD: 'Kreditkarte',
  DIRECT_DEBIT: 'Lastschrift',
  OTHER: 'Sonstiges',
};

export const PAYMENT_TYPES = ['INCOMING', 'OUTGOING'] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  INCOMING: 'Eingang',
  OUTGOING: 'Ausgang',
};

export type ProjectRefDto = {
  id: string;
  projectNumber: string;
  name: string;
};

export type PartyRefDto = {
  id: string;
  companyName: string;
};

export type SupplierDto = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  vatId: string | null;
  taxNumber: string | null;
  iban: string | null;
  paymentTerms: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BudgetLineDto = {
  id: string;
  projectId: string;
  category: BudgetCategory;
  notes: string | null;
  plannedAmount: string;
  committedAmount: string;
  actualAmount: string;
  remainingAmount: string;
  varianceAmount: string;
  variancePercent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseDto = {
  id: string;
  expenseNumber: string;
  projectId: string | null;
  category: BudgetCategory;
  supplierId: string | null;
  description: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  netAmount: string;
  taxRate: string;
  taxAmount: string;
  grossAmount: string;
  paidAmount: string;
  status: ExpenseStatus;
  paymentDate: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectRefDto | null;
  supplier: PartyRefDto | null;
};

export type InvoiceItemDto = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  netAmount: string;
  sortOrder: number;
};

export type InvoiceDto = {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  projectId: string | null;
  customerId: string | null;
  supplierId: string | null;
  issueDate: string;
  dueDate: string;
  netAmount: string;
  taxRate: string;
  taxAmount: string;
  grossAmount: string;
  paidAmount: string;
  status: InvoiceStatus;
  paymentTerms: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectRefDto | null;
  customer: PartyRefDto | null;
  supplier: PartyRefDto | null;
  items: InvoiceItemDto[];
};

export type PaymentDto = {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  projectId: string | null;
  paymentDate: string;
  amount: string;
  type: PaymentType;
  method: PaymentMethod;
  reference: string | null;
  bankReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    type: InvoiceType;
    status: InvoiceStatus;
  };
  project: ProjectRefDto | null;
};

export const SUBCONTRACTOR_TRADES = [
  'ELECTRICAL',
  'PLUMBING',
  'ROOFING',
  'CONCRETE',
  'PAINTING',
  'CARPENTRY',
  'HVAC',
  'OTHER',
] as const;

export type SubcontractorTrade = (typeof SUBCONTRACTOR_TRADES)[number];

export const SUBCONTRACTOR_TRADE_LABELS: Record<SubcontractorTrade, string> = {
  ELECTRICAL: 'Elektro',
  PLUMBING: 'Sanitär',
  ROOFING: 'Dach',
  CONCRETE: 'Beton',
  PAINTING: 'Maler',
  CARPENTRY: 'Zimmerei',
  HVAC: 'HLK',
  OTHER: 'Sonstiges',
};

export type PartnerTotalsDto = {
  totalPurchases: string;
  paidAmount: string;
  outstandingBalance: string;
};

export type SupplierListItemDto = SupplierDto & {
  totals?: PartnerTotalsDto;
};

export type SupplierDetailDto = SupplierDto & {
  totals: PartnerTotalsDto;
  invoices: InvoiceDto[];
  expenses: ExpenseDto[];
  projects: ProjectRefDto[];
};

export type SubcontractorDto = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  trade: SubcontractorTrade;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  vatId: string | null;
  taxNumber: string | null;
  contractValue: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totals?: PartnerTotalsDto & { assignedContractValue?: string };
};

export type SubcontractorDetailDto = SubcontractorDto & {
  totals: PartnerTotalsDto & { assignedContractValue?: string };
  projects: Array<{
    id: string;
    contractValue: string;
    notes: string | null;
    project: ProjectRefDto;
  }>;
  invoices: InvoiceDto[];
};

export const DOCUMENT_CATEGORIES = [
  'CONTRACT',
  'INVOICE',
  'RECEIPT',
  'PLAN',
  'PHOTO',
  'CERTIFICATE',
  'CORRESPONDENCE',
  'OTHER',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: 'Vertrag',
  INVOICE: 'Rechnung',
  RECEIPT: 'Beleg',
  PLAN: 'Plan',
  PHOTO: 'Foto',
  CERTIFICATE: 'Zertifikat',
  CORRESPONDENCE: 'Korrespondenz',
  OTHER: 'Sonstiges',
};

export type DocumentUploaderDto = {
  id: string;
  firstName: string;
  lastName: string;
};

export type DocumentDto = {
  id: string;
  title: string | null;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  category: DocumentCategory;
  description: string | null;
  projectId: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  project: ProjectRefDto | null;
  uploadedBy: DocumentUploaderDto;
};

export const REPORT_EXPORT_TYPES = [
  'summary',
  'profitability',
  'cashflow',
] as const;

export type ReportExportType = (typeof REPORT_EXPORT_TYPES)[number];

export type ReportPeriodDto = {
  from: string | null;
  to: string | null;
};

export type ReportKpisDto = {
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

export type ReportCashFlowMonthDto = {
  month: string;
  inflow: string;
  outflow: string;
  net: string;
};

export type ReportProjectProfitabilityDto = {
  projectId: string;
  projectNumber: string;
  name: string;
  status: ProjectStatus;
  revenue: string;
  costs: string;
  profit: string;
  profitMarginPercent: string | null;
  contractValue: string;
  currentBudget: string;
};

export type ReportExpenseCategoryDto = {
  category: BudgetCategory;
  amount: string;
};

export type ReportsSummaryDto = {
  currency: string;
  generatedAt: string;
  period: ReportPeriodDto;
  kpis: ReportKpisDto;
  monthlyCashFlow: ReportCashFlowMonthDto[];
  projectProfitability: ReportProjectProfitabilityDto[];
  expensesByCategory: ReportExpenseCategoryDto[];
};

export type CompanySettingsDto = {
  id: string;
  companyName: string;
  legalName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  vatId: string | null;
  taxNumber: string | null;
  iban: string | null;
  bic: string | null;
  defaultCurrency: string;
  defaultVatRate: string;
  invoicePrefix: string;
  createdAt: string;
  updatedAt: string;
};

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'INVITED'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Aktiv',
  INACTIVE: 'Inaktiv',
  INVITED: 'Eingeladen',
};

export type UserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type ProjectSubcontractorLinkDto = {
  id: string;
  contractValue: string;
  notes: string | null;
  subcontractor: {
    id: string;
    companyName: string;
    trade: SubcontractorTrade;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
  };
};

export type AuditActivityDto = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type AuditLogDto = AuditActivityDto & {
  ipAddress: string | null;
  userAgent: string | null;
  previousValue: unknown | null;
  newValue: unknown | null;
};

export type NotificationDto = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SearchHitDto = {
  type:
    | 'project'
    | 'invoice'
    | 'customer'
    | 'supplier'
    | 'subcontractor'
    | 'document'
    | 'expense';
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
};

export type SearchResponseDto = {
  query: string;
  results: SearchHitDto[];
};
