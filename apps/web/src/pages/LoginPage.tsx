import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_COMPANY_PLACEHOLDER, APP_NAME } from '@fbm/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { getLoginFieldDefaults } from './login-defaults';

const loginDefaults = getLoginFieldDefaults(import.meta.env.DEV);

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    '/';

  const [email, setEmail] = useState(loginDefaults.email);
  const [password, setPassword] = useState(loginDefaults.password);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" padding="lg">
        <div className="mb-6">
          <p className="text-sm font-semibold tracking-wide text-brand">
            {APP_NAME}
          </p>
          <h1 className="mt-1 text-page-title">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Finance & building management for {APP_COMPANY_PLACEHOLDER}
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-helper">
          Demo users are seeded locally (admin, management, accounting, project
          manager, viewer).
        </p>
      </Card>
    </div>
  );
}
