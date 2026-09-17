import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ROLES,
  USER_STATUSES,
  USER_STATUS_LABELS,
  roleHasPermission,
  type Role,
  type UserDto,
  type UserStatus,
} from '@fbm/shared';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatDateDe } from '../lib/format';
import {
  createUser,
  deactivateUser,
  fetchUsers,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '../services/users';

const emptyCreate: CreateUserInput = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'VIEWER',
  status: 'INVITED',
  password: '',
};

function statusTone(status: UserStatus) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'INVITED') return 'warning' as const;
  return 'neutral' as const;
}

export function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'users:write')
    : false;

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserInput>(emptyCreate);
  const [editForm, setEditForm] = useState<UpdateUserInput>({});
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        ...createForm,
        email: createForm.email.trim().toLowerCase(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
      }),
    onSuccess: async () => {
      setShowCreate(false);
      setCreateForm(emptyCreate);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Anlegen fehlgeschlagen',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('No user selected');
      const payload: UpdateUserInput = {
        email: editForm.email?.trim().toLowerCase(),
        firstName: editForm.firstName?.trim(),
        lastName: editForm.lastName?.trim(),
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password?.trim()) {
        payload.password = editForm.password.trim();
      }
      return updateUser(editingId, payload);
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditForm({});
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Speichern fehlgeschlagen',
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  function startEdit(row: UserDto) {
    setEditingId(row.id);
    setShowCreate(false);
    setFormError(null);
    setEditForm({
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      status: row.status,
      password: '',
    });
  }

  return (
    <div>
      <PageHeader
        title="Benutzer"
        description="Rollen und Kontostatus verwalten."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setShowCreate(true);
                setEditingId(null);
                setCreateForm(emptyCreate);
                setFormError(null);
              }}
            >
              Benutzer anlegen
            </Button>
          ) : null
        }
      />

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}

      {query.error instanceof ApiError && query.error.status === 403 ? (
        <EmptyState
          title="Zugriff eingeschränkt"
          description={`Ihre Rolle (${user?.role}) darf Benutzer nicht auflisten.`}
        />
      ) : null}

      {query.error instanceof ApiError && query.error.status !== 403 ? (
        <EmptyState
          title="Benutzer konnten nicht geladen werden"
          description={query.error.message}
        />
      ) : null}

      {showCreate && canWrite ? (
        <Card className="mb-4" title="Neuen Benutzer anlegen">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="E-Mail"
              name="email"
              type="email"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
            <Select
              label="Rolle"
              name="role"
              value={createForm.role}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  role: e.target.value as Role,
                }))
              }
              options={ROLES.map((role) => ({ value: role, label: role }))}
            />
            <Input
              label="Vorname"
              name="firstName"
              value={createForm.firstName}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  firstName: e.target.value,
                }))
              }
              required
            />
            <Input
              label="Nachname"
              name="lastName"
              value={createForm.lastName}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  lastName: e.target.value,
                }))
              }
              required
            />
            <Select
              label="Status"
              name="status"
              value={createForm.status ?? 'INVITED'}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  status: e.target.value as UserStatus,
                }))
              }
              options={USER_STATUSES.map((status) => ({
                value: status,
                label: USER_STATUS_LABELS[status],
              }))}
            />
            <Input
              label="Initialpasswort"
              name="password"
              type="password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              required
            />
          </div>
          {formError ? (
            <p className="mt-3 text-sm text-[var(--color-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Anlegen
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Abbrechen
            </Button>
          </div>
        </Card>
      ) : null}

      {editingId && canWrite ? (
        <Card className="mb-4" title="Benutzer bearbeiten">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="E-Mail"
              name="editEmail"
              type="email"
              value={editForm.email ?? ''}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <Select
              label="Rolle"
              name="editRole"
              value={editForm.role ?? 'VIEWER'}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  role: e.target.value as Role,
                }))
              }
              options={ROLES.map((role) => ({ value: role, label: role }))}
            />
            <Input
              label="Vorname"
              name="editFirstName"
              value={editForm.firstName ?? ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  firstName: e.target.value,
                }))
              }
            />
            <Input
              label="Nachname"
              name="editLastName"
              value={editForm.lastName ?? ''}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, lastName: e.target.value }))
              }
            />
            <Select
              label="Status"
              name="editStatus"
              value={editForm.status ?? 'ACTIVE'}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  status: e.target.value as UserStatus,
                }))
              }
              options={USER_STATUSES.map((status) => ({
                value: status,
                label: USER_STATUS_LABELS[status],
              }))}
            />
            <Input
              label="Neues Passwort (optional)"
              name="editPassword"
              type="password"
              value={editForm.password ?? ''}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, password: e.target.value }))
              }
            />
          </div>
          {formError ? (
            <p className="mt-3 text-sm text-[var(--color-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              Speichern
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setFormError(null);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </Card>
      ) : null}

      {query.data ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">E-Mail</th>
                  <th className="px-3 py-2 font-medium">Rolle</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Letzter Login</th>
                  {canWrite ? (
                    <th className="px-3 py-2 font-medium">Aktionen</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {query.data.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-3 py-3">{row.email}</td>
                    <td className="px-3 py-3">
                      <Badge tone="brand">{row.role}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone(row.status)}>
                        {USER_STATUS_LABELS[row.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      {formatDateDe(row.lastLoginAt)}
                    </td>
                    {canWrite ? (
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(row)}
                          >
                            Bearbeiten
                          </Button>
                          {row.status !== 'INACTIVE' && row.id !== user?.id ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Benutzer „${row.email}“ deaktivieren?`,
                                  )
                                ) {
                                  deactivateMutation.mutate(row.id);
                                }
                              }}
                            >
                              Deaktivieren
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
