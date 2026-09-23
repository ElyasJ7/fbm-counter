import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CURRENCY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  ROLE_LABELS,
  SUPPORTED_CURRENCIES,
  roleHasPermission,
  type ProjectStatus,
  type Role,
  type SupportedCurrency,
} from '@fbm/shared';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { FormSection } from '../components/ui/FormSection';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Textarea } from '../components/ui/Textarea';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { toDateInputValue } from '../lib/format';
import {
  createProject,
  fetchCustomers,
  fetchManagers,
  fetchProject,
  updateProject,
  type ProjectInput,
} from '../services/projects';

const emptyForm: ProjectInput = {
  projectNumber: '',
  name: '',
  description: '',
  customerId: '',
  customerContact: '',
  projectManagerId: '',
  siteStreet: '',
  sitePostalCode: '',
  siteCity: '',
  siteCountry: 'DE',
  startDate: '',
  expectedCompletionDate: '',
  actualCompletionDate: '',
  status: 'PLANNING',
  contractValue: '0.00',
  initialBudget: '0.00',
  currentBudget: '0.00',
  currency: 'EUR',
  progressPercent: 0,
  notes: '',
};

export function ProjectFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = user
    ? roleHasPermission(user.role, 'projects:write')
    : false;

  const [form, setForm] = useState<ProjectInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: isEdit,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'all-for-form'],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 100 }),
  });

  const managersQuery = useQuery({
    queryKey: ['managers'],
    queryFn: fetchManagers,
  });

  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data;
      setForm({
        projectNumber: p.projectNumber,
        name: p.name,
        description: p.description ?? '',
        customerId: p.customer.id,
        customerContact: p.customerContact ?? '',
        projectManagerId: p.projectManager?.id ?? '',
        siteStreet: p.siteStreet ?? '',
        sitePostalCode: p.sitePostalCode ?? '',
        siteCity: p.siteCity ?? '',
        siteCountry: p.siteCountry,
        startDate: toDateInputValue(p.startDate),
        expectedCompletionDate: toDateInputValue(p.expectedCompletionDate),
        actualCompletionDate: toDateInputValue(p.actualCompletionDate),
        status: p.status,
        contractValue: p.contractValue,
        initialBudget: p.initialBudget,
        currentBudget: p.currentBudget,
        currency: p.currency,
        progressPercent: p.progressPercent,
        notes: p.notes ?? '',
      });
    }
  }, [projectQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: ProjectInput = {
        ...form,
        projectNumber: form.projectNumber.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        customerContact: form.customerContact?.trim() || undefined,
        projectManagerId: form.projectManagerId || undefined,
        siteStreet: form.siteStreet?.trim() || undefined,
        sitePostalCode: form.sitePostalCode?.trim() || undefined,
        siteCity: form.siteCity?.trim() || undefined,
        startDate: form.startDate || undefined,
        expectedCompletionDate: form.expectedCompletionDate || undefined,
        actualCompletionDate: form.actualCompletionDate || undefined,
        notes: form.notes?.trim() || undefined,
        currentBudget: form.currentBudget || form.initialBudget,
        currency: form.currency || undefined,
      };
      if (isEdit && id) {
        return updateProject(id, payload);
      }
      return createProject(payload);
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      navigate(`/projects/${project.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    },
  });

  if (!canWrite) {
    return (
      <ErrorState
        title="Access denied"
        description="You do not have permission to create or edit projects."
        actionLabel="Back to projects"
        actionTo="/projects"
      />
    );
  }

  if (isEdit && projectQuery.isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Spinner className="h-8 w-8" />
        <span className="sr-only">Loading project</span>
      </div>
    );
  }

  if (isEdit && (projectQuery.error || !projectQuery.data)) {
    return (
      <ErrorState
        title="Project not found"
        description={
          projectQuery.error instanceof ApiError
            ? projectQuery.error.message
            : 'The requested project could not be loaded.'
        }
        actionLabel="Back to projects"
        actionTo="/projects"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Edit project' : 'New project'}
        description="Contract value and budgets are stored as decimal amounts in EUR."
        breadcrumbs={[
          { label: 'Projects', to: '/projects' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        actions={
          <Link to={isEdit && id ? `/projects/${id}` : '/projects'}>
            <Button variant="secondary">Cancel</Button>
          </Link>
        }
      />

      <Card padding="lg">
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            saveMutation.mutate();
          }}
          noValidate
        >
          {error ? (
            <Alert tone="danger" title="Could not save project">
              {error}
            </Alert>
          ) : null}

          <FormSection title="General information">
            <Input
              label="Project number"
              name="projectNumber"
              required
              value={form.projectNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, projectNumber: e.target.value }))
              }
            />
            <Input
              label="Project name"
              name="name"
              required
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <Select
              label="Status"
              name="status"
              value={form.status ?? 'PLANNING'}
              options={PROJECT_STATUSES.map((value) => ({
                value,
                label: PROJECT_STATUS_LABELS[value],
              }))}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as ProjectStatus,
                }))
              }
            />
            <Input
              label="Progress (%)"
              name="progressPercent"
              type="number"
              min={0}
              max={100}
              value={String(form.progressPercent ?? 0)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  progressPercent: Number(e.target.value),
                }))
              }
            />
            <div className="md:col-span-2">
              <Textarea
                label="Description"
                name="description"
                value={form.description ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
          </FormSection>

          <FormSection title="Customer & manager">
            <Select
              label="Customer"
              name="customerId"
              required
              value={form.customerId}
              placeholder="Select customer"
              options={
                customersQuery.data?.data.map((c) => ({
                  value: c.id,
                  label: c.companyName,
                })) ?? []
              }
              onChange={(e) =>
                setForm((prev) => ({ ...prev, customerId: e.target.value }))
              }
            />
            <Select
              label="Project manager"
              name="projectManagerId"
              value={form.projectManagerId ?? ''}
              placeholder="Unassigned"
              options={
                managersQuery.data?.map((m) => ({
                  value: m.id,
                  label: `${m.firstName} ${m.lastName} (${ROLE_LABELS[m.role as Role] ?? m.role})`,
                })) ?? []
              }
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  projectManagerId: e.target.value,
                }))
              }
            />
            <Input
              label="Customer contact"
              name="customerContact"
              value={form.customerContact ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  customerContact: e.target.value,
                }))
              }
            />
          </FormSection>

          <FormSection title="Location">
            <Input
              label="Site street"
              name="siteStreet"
              value={form.siteStreet ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, siteStreet: e.target.value }))
              }
            />
            <Input
              label="Country"
              name="siteCountry"
              value={form.siteCountry}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, siteCountry: e.target.value }))
              }
            />
            <Input
              label="Postal code"
              name="sitePostalCode"
              value={form.sitePostalCode ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sitePostalCode: e.target.value,
                }))
              }
            />
            <Input
              label="City"
              name="siteCity"
              value={form.siteCity ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, siteCity: e.target.value }))
              }
            />
          </FormSection>

          <FormSection title="Timeline">
            <Input
              label="Start date"
              name="startDate"
              type="date"
              value={form.startDate ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
            <Input
              label="Expected completion"
              name="expectedCompletionDate"
              type="date"
              value={form.expectedCompletionDate ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  expectedCompletionDate: e.target.value,
                }))
              }
            />
            <Input
              label="Actual completion"
              name="actualCompletionDate"
              type="date"
              value={form.actualCompletionDate ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  actualCompletionDate: e.target.value,
                }))
              }
            />
          </FormSection>

          <FormSection
            title="Financial information"
            description="Amounts are stored in the project currency."
          >
            <Select
              label="Project currency"
              name="currency"
              value={form.currency ?? 'EUR'}
              options={SUPPORTED_CURRENCIES.map((code) => ({
                value: code,
                label: CURRENCY_LABELS[code as SupportedCurrency],
              }))}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, currency: e.target.value }))
              }
            />
            <Input
              label={`Contract value (${form.currency ?? 'EUR'})`}
              name="contractValue"
              required
              inputMode="decimal"
              value={form.contractValue}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contractValue: e.target.value }))
              }
            />
            <Input
              label={`Initial budget (${form.currency ?? 'EUR'})`}
              name="initialBudget"
              required
              inputMode="decimal"
              value={form.initialBudget}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, initialBudget: e.target.value }))
              }
            />
            <Input
              label={`Current budget (${form.currency ?? 'EUR'})`}
              name="currentBudget"
              inputMode="decimal"
              value={form.currentBudget ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, currentBudget: e.target.value }))
              }
            />
          </FormSection>

          <FormSection title="Additional information" columns={1}>
            <Textarea
              label="Notes"
              name="notes"
              value={form.notes ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Link
              to={isEdit && id ? `/projects/${id}` : '/projects'}
              className="sm:order-none"
            >
              <Button type="button" variant="secondary" className="w-full sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save project'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
