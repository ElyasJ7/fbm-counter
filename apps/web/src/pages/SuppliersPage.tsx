import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { roleHasPermission } from '@fbm/shared';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyValue } from '../components/ui/CurrencyValue';
import {
  DataTable,
  dataTableHeadClassName,
  dataTableRowClassName,
  dataTableTdClassName,
  dataTableThClassName,
} from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterBar } from '../components/ui/FilterBar';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  type SupplierInput,
} from '../services/partners';

const emptyForm: SupplierInput = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'DE',
  vatId: '',
  iban: '',
  paymentTerms: '',
};

export function SuppliersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'suppliers:write')
    : false;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SupplierInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => fetchSuppliers({ page, pageSize: 20, search }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: SupplierInput = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        street: form.street?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || 'DE',
        vatId: form.vatId?.trim() || undefined,
        iban: form.iban?.trim() || undefined,
        paymentTerms: form.paymentTerms?.trim() || undefined,
      };
      return createSupplier(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setForm(emptyForm);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const title = useMemo(() => 'New supplier', []);
  const hasTotals = Boolean(
    query.data?.data.some((supplier) => supplier.totals),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Material and service suppliers."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setForm(emptyForm);
                setShowForm(true);
                setFormError(null);
              }}
            >
              New supplier
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <Input
          label="Search"
          name="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Company, contact, city…"
        />
      </FilterBar>

      {showForm && canWrite ? (
        <Card title={title}>
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
                setForm((prev) => ({ ...prev, companyName: e.target.value }))
              }
            />
            <Input
              label="Ansprechpartner"
              name="contactPerson"
              value={form.contactPerson ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactPerson: e.target.value }))
              }
            />
            <Input
              label="E-Mail"
              name="email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <Input
              label="Telefon"
              name="phone"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
            <Input
              label="Straße"
              name="street"
              value={form.street ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, street: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="PLZ"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, postalCode: e.target.value }))
                }
              />
              <Input
                label="Stadt"
                name="city"
                value={form.city ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <Input
              label="USt-IdNr."
              name="vatId"
              value={form.vatId ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vatId: e.target.value }))
              }
            />
            <Input
              label="IBAN"
              name="iban"
              value={form.iban ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, iban: e.target.value }))
              }
            />
            <Input
              label="Zahlungsbedingungen"
              name="paymentTerms"
              value={form.paymentTerms ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, paymentTerms: e.target.value }))
              }
            />
            {formError ? (
              <Alert tone="danger" className="md:col-span-2">
                {formError}
              </Alert>
            ) : null}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                Speichern
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}

      {query.error ? (
        <Alert tone="danger" title="Could not load suppliers">
          {query.error instanceof ApiError
            ? query.error.message
            : 'Unexpected error'}
        </Alert>
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add a supplier to assign expenses and inbound invoices."
          actionLabel={canWrite ? 'New supplier' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm(emptyForm);
                }
              : undefined
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <DataTable
          footer={
            <>
              <span>
                Page {query.data.meta.page} of {query.data.meta.totalPages} (
                {query.data.meta.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= query.data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          }
        >
          <table className="min-w-full text-left text-sm">
            <thead className={dataTableHeadClassName()}>
              <tr>
                <th className={dataTableThClassName()}>Company</th>
                <th className={dataTableThClassName()}>Contact</th>
                <th className={dataTableThClassName()}>City</th>
                <th className={dataTableThClassName()}>Email</th>
                {hasTotals ? (
                  <>
                    <th className={dataTableThClassName('right')}>Purchases</th>
                    <th className={dataTableThClassName('right')}>Paid</th>
                    <th className={dataTableThClassName('right')}>Open</th>
                  </>
                ) : null}
                <th className={dataTableThClassName()}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((supplier) => (
                <tr key={supplier.id} className={dataTableRowClassName()}>
                  <td className={`${dataTableTdClassName()} font-medium`}>
                    <Link
                      className="text-brand hover:underline"
                      to={`/suppliers/${supplier.id}`}
                    >
                      {supplier.companyName}
                    </Link>
                  </td>
                  <td className={dataTableTdClassName()}>
                    {supplier.contactPerson ?? '—'}
                  </td>
                  <td className={dataTableTdClassName()}>
                    {supplier.city ?? '—'}
                  </td>
                  <td className={dataTableTdClassName()}>
                    {supplier.email ?? '—'}
                  </td>
                  {hasTotals ? (
                    <>
                      <td className={dataTableTdClassName('right')}>
                        {supplier.totals ? (
                          <CurrencyValue
                            value={supplier.totals.totalPurchases}
                            size="sm"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        {supplier.totals ? (
                          <CurrencyValue
                            value={supplier.totals.paidAmount}
                            size="sm"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        {supplier.totals ? (
                          <CurrencyValue
                            value={supplier.totals.outstandingBalance}
                            size="sm"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    </>
                  ) : null}
                  <td className={dataTableTdClassName()}>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="text-brand hover:underline"
                        to={`/suppliers/${supplier.id}`}
                      >
                        Details
                      </Link>
                      <Link
                        className="text-brand hover:underline"
                        to={`/expenses?search=${encodeURIComponent(supplier.companyName)}`}
                      >
                        Expenses
                      </Link>
                      {canWrite ? (
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete supplier “${supplier.companyName}”?`,
                              )
                            ) {
                              deleteMutation.mutate(supplier.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      ) : null}
    </div>
  );
}
