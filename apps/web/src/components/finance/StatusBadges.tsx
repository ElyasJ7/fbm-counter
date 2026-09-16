import {
  EXPENSE_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  type ExpenseStatus,
  type InvoiceStatus,
  type InvoiceType,
  type PaymentMethod,
  type PaymentType,
} from '@fbm/shared';
import { Badge } from '../ui/Badge';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const expenseTone: Record<ExpenseStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  APPROVED: 'brand',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'danger',
};

const invoiceTone: Record<InvoiceStatus, Tone> = {
  DRAFT: 'neutral',
  SENT: 'brand',
  OPEN: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'danger',
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge tone={expenseTone[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={invoiceTone[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceTypeBadge({ type }: { type: InvoiceType }) {
  return (
    <Badge tone={type === 'CUSTOMER' ? 'brand' : 'neutral'}>
      {INVOICE_TYPE_LABELS[type]}
    </Badge>
  );
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return <Badge tone="neutral">{PAYMENT_METHOD_LABELS[method]}</Badge>;
}

export function PaymentTypeBadge({ type }: { type: PaymentType }) {
  return (
    <Badge tone={type === 'INCOMING' ? 'success' : 'warning'}>
      {PAYMENT_TYPE_LABELS[type]}
    </Badge>
  );
}
