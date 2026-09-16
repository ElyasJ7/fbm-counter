import { useQuery } from '@tanstack/react-query';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
};

export function UsersPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<UserRow[]>('/users'),
    retry: false,
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Role-based access control is enforced on the API. Full user administration expands in Phase 8."
      />

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}

      {query.error instanceof ApiError && query.error.status === 403 ? (
        <EmptyState
          title="Access restricted"
          description={`Your role (${user?.role}) cannot list users. Ask an administrator for access.`}
        />
      ) : null}

      {query.error instanceof ApiError && query.error.status !== 403 ? (
        <EmptyState
          title="Could not load users"
          description={query.error.message}
        />
      ) : null}

      {query.data ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Status</th>
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
                      <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {row.status}
                      </Badge>
                    </td>
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
