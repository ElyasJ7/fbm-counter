import type { Role, UserDto, UserStatus } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export type CreateUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status?: UserStatus;
  password: string;
};

export type UpdateUserInput = {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: Role;
  status?: UserStatus;
  password?: string;
};

export function fetchUsers() {
  return apiRequest<UserDto[]>('/users');
}

export function createUser(body: CreateUserInput) {
  return apiRequest<UserDto>('/users', { method: 'POST', body });
}

export function updateUser(id: string, body: UpdateUserInput) {
  return apiRequest<UserDto>(`/users/${id}`, { method: 'PATCH', body });
}

export function deactivateUser(id: string) {
  return apiRequest<UserDto>(`/users/${id}/deactivate`, { method: 'POST' });
}
