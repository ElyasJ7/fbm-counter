import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { roleHasPermission } from '@fbm/shared';
import {
  ExpenseStatusBadge,
  InvoiceStatusBadge,
} from '../components/finance/StatusBadges';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyValue } from '../components/ui/CurrencyValue';
import {
  dataTableHeadClassName,
  dataTableRowClassName,
  dataTableTdClassName,
  dataTableThClassName,
} from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatDateDe } from '../lib/format';
import {
  fetchSupplier,
  updateSupplier,
  type SupplierInput,
} from '../services/partners';

export function SupplierDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'suppliers:write')
    : false;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SupplierInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => fetchSupplier(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      companyName: query.data.companyName,
      contactPerson: query.data.contactPerson ?? '',
      email: query.data.email ?? '',
      phone: query.data.phone ?? '',
      street: query.data.street ?? '',
      postalCode: query.data.postalCode ?? '',
      city: query.data.city ?? '',
      country: query.data.country,
      vatId: query.data.vatId ?? '',
      taxNumber: query.data.taxNumber ?? '',
      iban: query.data.iban ?? '',
      paymentTerms: query.data.paymentTerms ?? '',
      notes: query.data.notes ?? '',
    });
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('Form not ready');
      const payload: Partial<SupplierInput> = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        street: form.street?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || 'DE',
        vatId: form.vatId?.trim() || undefined,
        taxNumber: form.taxNumber?.trim() || undefined,
        iban: form.iban?.trim() || undefined,
        paymentTerms: form.paymentTerms?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      return updateSupplier(id, payload);
    },
    onSuccess: async () => {
      setEditing(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <EmptyState
        title="Could not load supplier"
        description={
          query.error instanceof ApiError
            ? query.error.message
            : 'Unexpected error'
        }
        actionLabel="Back to suppliers"
        onAction={() => navigate('/suppliers')}
      />
    );
  }

  const supplier = query.data;
  const address = [supplier.street, [supplier.postalCode, supplier.city].filter(Boolean).join(' '), supplier.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.companyName}
        description="Supplier master data, purchases, and open balances."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/suppliers">
              <Button variant="secondary">All suppliers</Button>
            </Link>
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing((v) => !v);
                  setFormError(null);
                }}
              >
                {editing ? 'Close editing' : 'Edit'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total purchases"
          value={
            <CurrencyValue value={supplier.totals.totalPurchases} size="md" />
          }
        />
        <StatCard
          label="Paid"
          value={
            <CurrencyValue value={supplier.totals.paidAmount} size="md" />
          }
        />
        <StatCard
          label="Outstanding"
          value={
            <CurrencyValue
              value={supplier.totals.outstandingBalance}
              size="md"
            />
          }
        />
      </div>

      {editing && canWrite && form ? (
        <Card title="Edit supplier">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              label="Company Name"
              name="companyName"
              required
              value={form.companyName}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, companyName: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Contact Person"
              name="contactPerson"
              value={form.contactPerson ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, contactPerson: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, email: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Phone"
              name="phone"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, phone: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Street"
              name="street"
              value={form.street ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, street: e.target.value } : prev,
                )
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Postal Code"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, postalCode: e.target.value } : prev,
                  )
                }
              />
              <Input
                label="City"
                name="city"
                value={form.city ?? ''}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, city: e.target.value } : prev,
                  )
                }
              />
            </div>
            <Input
              label="VAT ID"
              name="vatId"
              value={form.vatId ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, vatId: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Tax Number"
              name="taxNumber"
              value={form.taxNumber ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, taxNumber: e.target.value } : prev,
                )
              }
            />
            <Input
              label="IBAN"
              name="iban"
              value={form.iban ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, iban: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Payment Terms"
              name="paymentTerms"
              value={form.paymentTerms ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, paymentTerms: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Notes"
              name="notes"
              value={form.notes ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, notes: e.target.value } : prev,
                )
              }
            />
            {formError ? (
              <Alert tone="danger" className="md:col-span-2">
                {formError}
              </Alert>
            ) : null}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Contact">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">Contact person</dt>
              <dd className="font-medium">{supplier.contactPerson ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd>{supplier.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Phone</dt>
              <dd>{supplier.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Address</dt>
              <dd>{address || '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Payment details">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">VAT ID</dt>
              <dd>{supplier.vatId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Tax number</dt>
              <dd>{supplier.taxNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">IBAN</dt>
              <dd>{supplier.iban ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Payment terms</dt>
              <dd>{supplier.paymentTerms ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Invoices" padding="none">
          {supplier.invoices.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">
              No invoices assigned.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={dataTableHeadClassName()}>
                  <tr>
                    <th className={dataTableThClassName()}>Number</th>
                    <th className={dataTableThClassName()}>Status</th>
                    <th className={dataTableThClassName()}>Date</th>
                    <th className={dataTableThClassName('right')}>Gross</th>
                    <th className={dataTableThClassName()}>Project</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.invoices.map((invoice) => (
                    <tr key={invoice.id} className={dataTableRowClassName()}>
                      <td className={`${dataTableTdClassName()} font-medium`}>
                        <Link
                          className="text-brand hover:underline"
                          to={`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className={dataTableTdClassName()}>
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {formatDateDe(invoice.issueDate)}
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        <CurrencyValue value={invoice.grossAmount} size="sm" />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {invoice.project ? (
                          <Link
                            className="text-brand hover:underline"
                            to={`/projects/${invoice.project.id}`}
                          >
                            {invoice.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Expenses" padding="none">
          {supplier.expenses.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">
              No expenses assigned.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={dataTableHeadClassName()}>
                  <tr>
                    <th className={dataTableThClassName()}>Number</th>
                    <th className={dataTableThClassName()}>Description</th>
                    <th className={dataTableThClassName()}>Status</th>
                    <th className={dataTableThClassName('right')}>Gross</th>
                    <th className={dataTableThClassName()}>Project</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.expenses.map((expense) => (
                    <tr key={expense.id} className={dataTableRowClassName()}>
                      <td className={`${dataTableTdClassName()} font-medium`}>
                        <Link
                          className="text-brand hover:underline"
                          to={`/expenses?search=${encodeURIComponent(expense.expenseNumber)}`}
                        >
                          {expense.expenseNumber}
                        </Link>
                      </td>
                      <td className={dataTableTdClassName()}>
                        {expense.description}
                      </td>
                      <td className={dataTableTdClassName()}>
                        <ExpenseStatusBadge status={expense.status} />
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        <CurrencyValue value={expense.grossAmount} size="sm" />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {expense.project ? (
                          <Link
                            className="text-brand hover:underline"
                            to={`/projects/${expense.project.id}`}
                          >
                            {expense.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Related projects">
          {supplier.projects.length === 0 ? (
            <p className="text-sm text-muted">No projects linked.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {supplier.projects.map((project) => (
                <li key={project.id}>
                  <Link
                    className="font-medium text-brand hover:underline"
                    to={`/projects/${project.id}`}
                  >
                    {project.projectNumber} · {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
