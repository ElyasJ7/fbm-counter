import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { roleHasPermission } from '@fbm/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
  type CustomerInput,
} from '../services/projects';

const emptyForm: CustomerInput = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'DE',
  vatId: '',
  taxNumber: '',
  notes: '',
};

export function CustomersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'projects:write')
    : false;
  const canDelete = user
    ? roleHasPermission(user.role, 'projects:delete')
    : false;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => fetchCustomers({ page, pageSize: 20, search }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: CustomerInput = {
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
        notes: form.notes?.trim() || undefined,
      };
      if (editingId) {
        return updateCustomer(editingId, payload);
      }
      return createCustomer(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const title = useMemo(
    () => (editingId ? 'Edit customer' : 'New customer'),
    [editingId],
  );

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Customer master data for construction projects."
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
              New customer
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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
      </div>

      {showForm && canWrite ? (
        <Card className="mb-6" title={title}>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              label="Company name"
              name="companyName"
              required
              value={form.companyName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, companyName: e.target.value }))
              }
            />
            <Input
              label="Contact person"
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
              label="Street"
              name="street"
              value={form.street ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, street: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Postal code"
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
              label="Tax number"
              name="taxNumber"
              value={form.taxNumber ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, taxNumber: e.target.value }))
              }
            />
            {formError ? (
              <p className="md:col-span-2 text-sm text-[var(--color-danger)]">
                {formError}
              </p>
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
        <EmptyState
          title="Could not load customers"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unexpected error'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add a customer before creating construction projects."
          actionLabel={canWrite ? 'New customer' : undefined}
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
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">City</th>
                  <th className="px-3 py-2 font-medium">Projects</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">
                      {customer.companyName}
                    </td>
                    <td className="px-3 py-3">
                      {customer.contactPerson ?? '—'}
                    </td>
                    <td className="px-3 py-3">{customer.city ?? '—'}</td>
                    <td className="px-3 py-3">
                      {customer._count?.projects ?? 0}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/projects?customerId=${customer.id}`}
                        >
                          Projects
                        </Link>
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-slate-700 hover:underline"
                            onClick={() => {
                              setEditingId(customer.id);
                              setForm({
                                companyName: customer.companyName,
                                contactPerson: customer.contactPerson ?? '',
                                email: customer.email ?? '',
                                phone: customer.phone ?? '',
                                street: customer.street ?? '',
                                postalCode: customer.postalCode ?? '',
                                city: customer.city ?? '',
                                country: customer.country,
                                vatId: customer.vatId ?? '',
                                taxNumber: customer.taxNumber ?? '',
                                notes: customer.notes ?? '',
                              });
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="text-[var(--color-danger)] hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete customer “${customer.companyName}”?`,
                                )
                              ) {
                                deleteMutation.mutate(customer.id);
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
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-muted)]">
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
          </div>
        </Card>
      ) : null}
    </div>
  );
}
