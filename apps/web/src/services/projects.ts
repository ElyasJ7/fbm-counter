import type {
  AuditActivityDto,
  CustomerDto,
  PaginatedResponse,
  ProjectDetailDto,
  ProjectListItemDto,
  ProjectStatus,
  ProjectSubcontractorLinkDto,
} from '@fbm/shared';
import { apiRequest } from '../lib/api';

export type CustomerInput = {
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  vatId?: string;
  taxNumber?: string;
  notes?: string;
};

export type ProjectInput = {
  projectNumber: string;
  name: string;
  description?: string;
  customerId: string;
  customerContact?: string;
  projectManagerId?: string;
  siteStreet?: string;
  sitePostalCode?: string;
  siteCity?: string;
  siteCountry?: string;
  startDate?: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  status?: ProjectStatus;
  contractValue: string;
  initialBudget: string;
  currentBudget?: string;
  currency?: string;
  progressPercent?: number;
  notes?: string;
};

export function fetchCustomers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query}` : '';
  return apiRequest<PaginatedResponse<CustomerDto>>(`/customers${suffix}`);
}

export function fetchCustomer(id: string) {
  return apiRequest<CustomerDto>(`/customers/${id}`);
}

export function createCustomer(body: CustomerInput) {
  return apiRequest<CustomerDto>('/customers', { method: 'POST', body });
}

export function updateCustomer(id: string, body: Partial<CustomerInput>) {
  return apiRequest<CustomerDto>(`/customers/${id}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteCustomer(id: string) {
  return apiRequest<{ success: boolean }>(`/customers/${id}`, {
    method: 'DELETE',
  });
}

export function fetchProjects(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ProjectStatus | '';
  customerId?: string;
  projectManagerId?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.projectManagerId)
    query.set('projectManagerId', params.projectManagerId);
  const suffix = query.toString() ? `?${query}` : '';
  return apiRequest<PaginatedResponse<ProjectListItemDto>>(
    `/projects${suffix}`,
  );
}

export function fetchProject(id: string) {
  return apiRequest<ProjectDetailDto>(`/projects/${id}`);
}

export function createProject(body: ProjectInput) {
  return apiRequest<ProjectDetailDto>('/projects', { method: 'POST', body });
}

export function updateProject(id: string, body: Partial<ProjectInput>) {
  return apiRequest<ProjectDetailDto>(`/projects/${id}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteProject(id: string) {
  return apiRequest<{ success: boolean }>(`/projects/${id}`, {
    method: 'DELETE',
  });
}

export function fetchManagers() {
  return apiRequest<
    Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    }>
  >('/users/managers');
}

export function fetchProjectSubcontractors(projectId: string) {
  return apiRequest<ProjectSubcontractorLinkDto[]>(
    `/projects/${projectId}/subcontractors`,
  );
}

export function fetchProjectActivity(projectId: string) {
  return apiRequest<AuditActivityDto[]>(`/projects/${projectId}/activity`);
}
