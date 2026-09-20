import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  roleHasPermission,
  SUBCONTRACTOR_TRADES,
  SUBCONTRACTOR_TRADE_LABELS,
  type SubcontractorTrade,
} from '@fbm/shared';
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
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import {
  createSubcontractor,
  deleteSubcontractor,
  fetchSubcontractors,
  updateSubcontractor,
  type SubcontractorInput,
} from '../services/partners';

const emptyForm: SubcontractorInput = {
  companyName: '',
  contactPerson: '',
  trade: 'OTHER',
  email: '',
  phone: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'DE',
  vatId: '',
  taxNumber: '',
  contractValue: '0',
  notes: '',
};

const tradeOptions = SUBCONTRACTOR_TRADES.map((trade) => ({
  value: trade,
  label: SUBCONTRACTOR_TRADE_LABELS[trade],
}));

export function SubcontractorsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'subcontractors:write')
    : false;

  const [search, setSearch] = useState('');
  const [trade, setTrade] = useState<SubcontractorTrade | ''>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubcontractorInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['subcontractors', page, search, trade],
    queryFn: () =>
      fetchSubcontractors({ page, pageSize: 20, search, trade }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: SubcontractorInput = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson?.trim() || undefined,
        trade: form.trade,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        street: form.street?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || 'DE',
        vatId: form.vatId?.trim() || undefined,
        taxNumber: form.taxNumber?.trim() || undefined,
        contractValue: form.contractValue?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      if (editingId) {
        return updateSubcontractor(editingId, payload);
      }
      return createSubcontractor(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubcontractor(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
  });

  const title = useMemo(
    () => (editingId ? 'Edit subcontractor' : 'New subcontractor'),
    [editingId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subcontractors"
        description="Trade partners assigned to projects."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm(true);
                setFormError(null);
              }}
            >
              New subcontractor
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
        <Select
          label="Trade"
          name="tradeFilter"
          value={trade}
          placeholder="All trades"
          options={tradeOptions}
          onChange={(e) => {
            setTrade((e.target.value as SubcontractorTrade | '') || '');
            setPage(1);
          }}
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
              label="Company Name"
              name="companyName"
              required
              value={form.companyName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, companyName: e.target.value }))
              }
            />
            <Select
              label="Trade"
              name="trade"
              required
              value={form.trade}
              options={tradeOptions}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  trade: e.target.value as SubcontractorTrade,
                }))
              }
            />
            <Input
              label="Contact Person"
              name="contactPerson"
              value={form.contactPerson ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactPerson: e.target.value }))
              }
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <Input
              label="Phone"
              name="phone"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
            <Input
              label="Contract Value"
              name="contractValue"
              value={form.contractValue ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contractValue: e.target.value }))
              }
            />
            <Input
              label="Street"
              name="street"
              value={form.street ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, street: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Postal Code"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, postalCode: e.target.value }))
                }
              />
              <Input
                label="City"
                name="city"
                value={form.city ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <Input
              label="VAT ID"
              name="vatId"
              value={form.vatId ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vatId: e.target.value }))
              }
            />
            <Input
              label="Tax Number"
              name="taxNumber"
              value={form.taxNumber ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, taxNumber: e.target.value }))
              }
            />
            <Input
              label="Notes"
              name="notes"
              value={form.notes ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
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
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
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
        <Alert tone="danger" title="Could not load subcontractors">
          {query.error instanceof ApiError
            ? query.error.message
            : 'Unexpected error'}
        </Alert>
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No subcontractors yet"
          description="Add subcontractors and assign them to projects."
          actionLabel={canWrite ? 'New subcontractor' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm(emptyForm);
                  setEditingId(null);
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
                <th className={dataTableThClassName()}>Trade</th>
                <th className={dataTableThClassName()}>Contact</th>
                <th className={dataTableThClassName()}>City</th>
                <th className={dataTableThClassName('right')}>Contract value</th>
                <th className={dataTableThClassName()}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((row) => (
                <tr key={row.id} className={dataTableRowClassName()}>
                  <td className={`${dataTableTdClassName()} font-medium`}>
                    <Link
                      className="text-brand hover:underline"
                      to={`/subcontractors/${row.id}`}
                    >
                      {row.companyName}
                    </Link>
                  </td>
                  <td className={dataTableTdClassName()}>
                    {SUBCONTRACTOR_TRADE_LABELS[row.trade]}
                  </td>
                  <td className={dataTableTdClassName()}>
                    {row.contactPerson ?? '—'}
                  </td>
                  <td className={dataTableTdClassName()}>{row.city ?? '—'}</td>
                  <td className={dataTableTdClassName('right')}>
                    <CurrencyValue value={row.contractValue} size="sm" />
                  </td>
                  <td className={dataTableTdClassName()}>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="text-brand hover:underline"
                        to={`/subcontractors/${row.id}`}
                      >
                        Details
                      </Link>
                      {canWrite ? (
                        <button
                          type="button"
                          className="text-ink hover:underline"
                          onClick={() => {
                            setEditingId(row.id);
                            setForm({
                              companyName: row.companyName,
                              contactPerson: row.contactPerson ?? '',
                              trade: row.trade,
                              email: row.email ?? '',
                              phone: row.phone ?? '',
                              street: row.street ?? '',
                              postalCode: row.postalCode ?? '',
                              city: row.city ?? '',
                              country: row.country,
                              vatId: row.vatId ?? '',
                              taxNumber: row.taxNumber ?? '',
                              contractValue: row.contractValue,
                              notes: row.notes ?? '',
                            });
                            setShowForm(true);
                            setFormError(null);
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canWrite ? (
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete subcontractor “${row.companyName}”?`,
                              )
                            ) {
                              deleteMutation.mutate(row.id);
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
