import type { AuthUserDto } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export function login(email: string, password: string) {
  return apiRequest<{ user: AuthUserDto }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function logout() {
  return apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

export function fetchMe() {
  return apiRequest<AuthUserDto>('/auth/me');
}

export function refreshSession() {
  return apiRequest<{ user: AuthUserDto }>('/auth/refresh', { method: 'POST' });
}

export function updatePreferences(input: {
  preferredDisplayCurrency?: string | null;
}) {
  return apiRequest<AuthUserDto>('/auth/me/preferences', {
    method: 'PATCH',
    body: input,
  });
}
