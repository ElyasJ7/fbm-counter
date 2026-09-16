import type {
  PaginatedResponse,
  SubcontractorDetailDto,
  SubcontractorDto,
  SubcontractorTrade,
  SupplierDetailDto,
  SupplierDto,
  SupplierListItemDto,
} from '@fbm/shared';
import { apiRequest } from '../lib/api';

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const s = query.toString();
  return s ? `?${s}` : '';
}

export type SupplierInput = {
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
  iban?: string;
  paymentTerms?: string;
  notes?: string;
};

export type SubcontractorInput = {
  companyName: string;
  contactPerson?: string;
  trade: SubcontractorTrade;
  email?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  vatId?: string;
  taxNumber?: string;
  contractValue?: string;
  notes?: string;
};

export function fetchSuppliers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<SupplierListItemDto>>(
    `/suppliers${toQuery(params)}`,
  );
}

export function fetchSupplier(id: string) {
  return apiRequest<SupplierDetailDto>(`/suppliers/${id}`);
}

export function createSupplier(body: SupplierInput) {
  return apiRequest<SupplierDto>('/suppliers', { method: 'POST', body });
}

export function updateSupplier(id: string, body: Partial<SupplierInput>) {
  return apiRequest<SupplierDto>(`/suppliers/${id}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteSupplier(id: string) {
  return apiRequest<{ success: boolean }>(`/suppliers/${id}`, {
    method: 'DELETE',
  });
}

export function fetchSubcontractors(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  trade?: SubcontractorTrade | '';
}) {
  return apiRequest<PaginatedResponse<SubcontractorDto>>(
    `/subcontractors${toQuery(params)}`,
  );
}

export function fetchSubcontractor(id: string) {
  return apiRequest<SubcontractorDetailDto>(`/subcontractors/${id}`);
}

export function createSubcontractor(body: SubcontractorInput) {
  return apiRequest<SubcontractorDto>('/subcontractors', {
    method: 'POST',
    body,
  });
}

export function updateSubcontractor(
  id: string,
  body: Partial<SubcontractorInput>,
) {
  return apiRequest<SubcontractorDto>(`/subcontractors/${id}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteSubcontractor(id: string) {
  return apiRequest<{ success: boolean }>(`/subcontractors/${id}`, {
    method: 'DELETE',
  });
}

export function assignSubcontractorProject(
  id: string,
  body: { projectId: string; contractValue?: string; notes?: string },
) {
  return apiRequest(`/subcontractors/${id}/projects`, {
    method: 'POST',
    body,
  });
}

export function unassignSubcontractorProject(
  id: string,
  projectId: string,
) {
  return apiRequest<{ success: boolean }>(
    `/subcontractors/${id}/projects/${projectId}`,
    { method: 'DELETE' },
  );
}
