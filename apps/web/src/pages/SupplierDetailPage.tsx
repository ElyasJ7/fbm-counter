import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { roleHasPermission } from '@fbm/shared';
import {
  ExpenseStatusBadge,
  InvoiceStatusBadge,
} from '../components/finance/StatusBadges';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency, formatDateDe } from '../lib/format';
import {
  fetchSupplier,
  updateSupplier,
  type SupplierInput,
} from '../services/partners';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-slate-50 p-4">
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}

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
        title="Lieferant konnte nicht geladen werden"
        description={
          query.error instanceof ApiError
            ? query.error.message
            : 'Unerwarteter Fehler'
        }
        actionLabel="Zurück zu Lieferanten"
        onAction={() => navigate('/suppliers')}
      />
    );
  }

  const supplier = query.data;
  const address = [supplier.street, [supplier.postalCode, supplier.city].filter(Boolean).join(' '), supplier.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div>
      <PageHeader
        title={supplier.companyName}
        description="Lieferanten-Stammdaten, Einkäufe und offene Beträge."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/suppliers">
              <Button variant="secondary">Alle Lieferanten</Button>
            </Link>
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing((v) => !v);
                  setFormError(null);
                }}
              >
                {editing ? 'Bearbeitung schließen' : 'Bearbeiten'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Einkäufe gesamt"
          value={formatCurrency(supplier.totals.totalPurchases)}
        />
        <Metric
          label="Bezahlt"
          value={formatCurrency(supplier.totals.paidAmount)}
        />
        <Metric
          label="Offen"
          value={formatCurrency(supplier.totals.outstandingBalance)}
        />
      </div>

      {editing && canWrite && form ? (
        <Card className="mb-6" title="Lieferant bearbeiten">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              label="Firmenname"
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
              label="Ansprechpartner"
              name="contactPerson"
              value={form.contactPerson ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, contactPerson: e.target.value } : prev,
                )
              }
            />
            <Input
              label="E-Mail"
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
              label="Telefon"
              name="phone"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, phone: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Straße"
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
                label="PLZ"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, postalCode: e.target.value } : prev,
                  )
                }
              />
              <Input
                label="Stadt"
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
              label="USt-IdNr."
              name="vatId"
              value={form.vatId ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, vatId: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Steuernummer"
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
              label="Zahlungsbedingungen"
              name="paymentTerms"
              value={form.paymentTerms ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, paymentTerms: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Notizen"
              name="notes"
              value={form.notes ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, notes: e.target.value } : prev,
                )
              }
            />
            {formError ? (
              <p className="md:col-span-2 text-sm text-[var(--color-danger)]">
                {formError}
              </p>
            ) : null}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                Speichern
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Kontaktdaten">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Ansprechpartner</dt>
              <dd className="font-medium">{supplier.contactPerson ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">E-Mail</dt>
              <dd>{supplier.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Telefon</dt>
              <dd>{supplier.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Adresse</dt>
              <dd>{address || '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Zahlungsdaten">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">USt-IdNr.</dt>
              <dd>{supplier.vatId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Steuernummer</dt>
              <dd>{supplier.taxNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">IBAN</dt>
              <dd>{supplier.iban ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Zahlungsbedingungen</dt>
              <dd>{supplier.paymentTerms ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Rechnungen">
          {supplier.invoices.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Keine Rechnungen zugeordnet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nummer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Datum</th>
                    <th className="px-3 py-2 font-medium">Brutto</th>
                    <th className="px-3 py-2 font-medium">Projekt</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium">
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className="px-3 py-3">
                        {formatDateDe(invoice.issueDate)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(invoice.grossAmount)}
                      </td>
                      <td className="px-3 py-3">
                        {invoice.project ? (
                          <Link
                            className="text-[var(--color-brand)] hover:underline"
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

        <Card title="Ausgaben">
          {supplier.expenses.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Keine Ausgaben zugeordnet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nummer</th>
                    <th className="px-3 py-2 font-medium">Beschreibung</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Brutto</th>
                    <th className="px-3 py-2 font-medium">Projekt</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.expenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium">
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/expenses?search=${encodeURIComponent(expense.expenseNumber)}`}
                        >
                          {expense.expenseNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{expense.description}</td>
                      <td className="px-3 py-3">
                        <ExpenseStatusBadge status={expense.status} />
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(expense.grossAmount)}
                      </td>
                      <td className="px-3 py-3">
                        {expense.project ? (
                          <Link
                            className="text-[var(--color-brand)] hover:underline"
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

        <Card title="Verwandte Projekte">
          {supplier.projects.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Keine Projekte verknüpft.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {supplier.projects.map((project) => (
                <li key={project.id}>
                  <Link
                    className="font-medium text-[var(--color-brand)] hover:underline"
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
