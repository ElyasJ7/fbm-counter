export const ROLES = [
  'ADMIN',
  'MANAGEMENT',
  'ACCOUNTING',
  'PROJECT_MANAGER',
  'VIEWER',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGEMENT: 'Management',
  ACCOUNTING: 'Accounting',
  PROJECT_MANAGER: 'Project Manager',
  VIEWER: 'Viewer',
};

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

/** Supported transaction / display currencies (Phase B+). */
export const SUPPORTED_CURRENCIES = ['AFN', 'EUR', 'USD'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Company base currency default for new installs (legacy EUR semantics). */
export const DEFAULT_CURRENCY: SupportedCurrency = 'EUR';

/** Default display currency mirrors base until the user changes it. */
export const DEFAULT_DISPLAY_CURRENCY: SupportedCurrency = DEFAULT_CURRENCY;

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  AFN: 'Afghan Afghani (AFN)',
  EUR: 'Euro (EUR)',
  USD: 'US Dollar (USD)',
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  AFN: '؋',
  EUR: '€',
  USD: '$',
};

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(
    value.trim().toUpperCase(),
  );
}

export function assertSupportedCurrency(value: string): SupportedCurrency {
  const code = value.trim().toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new Error(
      `Unsupported currency "${value}". Allowed: ${SUPPORTED_CURRENCIES.join(', ')}`,
    );
  }
  return code;
}

/** Supported company timezones (date-only business dates remain UTC-safe). */
export const SUPPORTED_TIMEZONES = [
  'UTC',
  'Asia/Kabul',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
] as const;

export type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];

export const DEFAULT_TIMEZONE: SupportedTimezone = 'UTC';

export const TIMEZONE_LABELS: Record<SupportedTimezone, string> = {
  UTC: 'UTC',
  'Asia/Kabul': 'Asia/Kabul (Afghanistan)',
  'Europe/Berlin': 'Europe/Berlin',
  'Europe/London': 'Europe/London',
  'America/New_York': 'America/New_York',
};

export function isSupportedTimezone(value: string): value is SupportedTimezone {
  return (SUPPORTED_TIMEZONES as readonly string[]).includes(value.trim());
}

export function assertSupportedTimezone(value: string): SupportedTimezone {
  const tz = value.trim();
  if (!isSupportedTimezone(tz)) {
    throw new Error(
      `Unsupported timezone "${value}". Allowed: ${SUPPORTED_TIMEZONES.join(', ')}`,
    );
  }
  return tz;
}

export const APP_NAME = 'FBM Counter';
export const APP_COMPANY_PLACEHOLDER = 'Sample Construction Ltd';

export type AuthUserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** Preferred UI reporting currency; null uses company defaultDisplayCurrency. */
  preferredDisplayCurrency: string | null;
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
  MATERIALS: 'Materials',
  LABOR: 'Labor',
  SUBCONTRACTORS: 'Subcontractors',
  EQUIPMENT: 'Equipment',
  TRANSPORTATION: 'Transportation',
  PERMITS: 'Permits',
  INSURANCE: 'Insurance',
  PROFESSIONAL_SERVICES: 'Professional Services',
  OTHER: 'Other',
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
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

export const INVOICE_TYPES = ['CUSTOMER', 'SUPPLIER'] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  CUSTOMER: 'Customer Invoice',
  SUPPLIER: 'Supplier Invoice',
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
  DRAFT: 'Draft',
  SENT: 'Sent',
  OPEN: 'Open',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
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
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DIRECT_DEBIT: 'Direct Debit',
  OTHER: 'Other',
};

export const PAYMENT_TYPES = ['INCOMING', 'OUTGOING'] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  INCOMING: 'Incoming Payment',
  OUTGOING: 'Outgoing Payment',
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
  /** Transaction currency (AFN | EUR | USD). */
  currency: string;
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
  /** Transaction currency (AFN | EUR | USD). */
  currency: string;
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
  /** Matches invoice transaction currency (cross-currency deferred). */
  currency: string;
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
    currency?: string;
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
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  ROOFING: 'Roofing',
  CONCRETE: 'Concrete',
  PAINTING: 'Painting',
  CARPENTRY: 'Carpentry',
  HVAC: 'HVAC',
  OTHER: 'Other',
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
  CONTRACT: 'Contract',
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
  PLAN: 'Plan',
  PHOTO: 'Photo',
  CERTIFICATE: 'Certificate',
  CORRESPONDENCE: 'Correspondence',
  OTHER: 'Other',
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

/** FX metadata for dashboard / reports display conversion. */
export type DisplayFxMetaDto = {
  status: MoneyConversionStatus;
  baseCurrency: string;
  displayCurrency: string;
  exchangeRate: string | null;
  effectiveAt: string | null;
  fetchedAt: string | null;
  provider: string | null;
};

export type ReportsSummaryDto = {
  /** Amounts are labeled in this currency (books if FX unavailable). */
  currency: string;
  baseCurrency: string;
  displayCurrency: string;
  fx: DisplayFxMetaDto;
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
  /** Company base / books currency (AFN | EUR | USD). */
  defaultCurrency: string;
  /** Default UI reporting currency for users without a personal preference. */
  defaultDisplayCurrency: string;
  /** Company timezone for regional display (business dates remain date-only/UTC). */
  timezone: string;
  defaultVatRate: string;
  invoicePrefix: string;
  createdAt: string;
  updatedAt: string;
};

export const EXCHANGE_RATE_SOURCES = ['PROVIDER', 'MANUAL'] as const;
export type ExchangeRateSource = (typeof EXCHANGE_RATE_SOURCES)[number];

export type ExchangeRateDto = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  provider: string;
  source: ExchangeRateSource;
  effectiveAt: string;
  fetchedAt: string;
  reason: string | null;
  createdById: string | null;
  createdAt: string;
};

export type ExchangeRatesLatestDto = {
  rates: ExchangeRateDto[];
  lastUpdatedAt: string | null;
  providerConfigured: boolean;
};

/** Result of a centralized FX conversion (display or accounting). */
export type MoneyConversionStatus = 'converted' | 'identity' | 'unavailable';

export type MoneyConversionResultDto = {
  status: MoneyConversionStatus;
  originalAmount: string;
  originalCurrency: string;
  /** Null when status === unavailable. */
  convertedAmount: string | null;
  convertedCurrency: string;
  exchangeRate: string | null;
  effectiveAt: string | null;
  fetchedAt: string | null;
  source: ExchangeRateSource | 'IDENTITY' | null;
  provider: string | null;
  rateId: string | null;
  /** true when using current/latest rate for UI display (not a booking snapshot). */
  isDisplayConversion: boolean;
};

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'INVITED'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  INVITED: 'Invited',
};

export type UserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  preferredDisplayCurrency: string | null;
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
