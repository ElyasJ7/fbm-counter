import type {
  DocumentCategory,
  DocumentDto,
  PaginatedResponse,
} from '@fbm/shared';
import { apiDownloadUrl, apiRequest, apiUpload } from '../lib/api';

export type DocumentListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  projectId?: string;
  category?: DocumentCategory | '';
};

export type UploadDocumentInput = {
  file: File;
  title?: string;
  category?: DocumentCategory;
  description?: string;
  projectId?: string;
};

export type UpdateDocumentInput = {
  title?: string;
  category?: DocumentCategory;
  description?: string;
  projectId?: string | null;
};

export function fetchDocuments(params: DocumentListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.projectId) query.set('projectId', params.projectId);
  if (params.category) query.set('category', params.category);
  const qs = query.toString();
  return apiRequest<PaginatedResponse<DocumentDto>>(
    `/documents${qs ? `?${qs}` : ''}`,
  );
}

export function fetchDocument(id: string) {
  return apiRequest<DocumentDto>(`/documents/${id}`);
}

export function uploadDocument(input: UploadDocumentInput) {
  const formData = new FormData();
  formData.append('file', input.file);
  if (input.title?.trim()) formData.append('title', input.title.trim());
  if (input.category) formData.append('category', input.category);
  if (input.description?.trim()) {
    formData.append('description', input.description.trim());
  }
  if (input.projectId) formData.append('projectId', input.projectId);
  return apiUpload<DocumentDto>('/documents', formData);
}

export function updateDocument(id: string, input: UpdateDocumentInput) {
  return apiRequest<DocumentDto>(`/documents/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteDocument(id: string) {
  return apiRequest<{ success: boolean }>(`/documents/${id}`, {
    method: 'DELETE',
  });
}

export function documentDownloadUrl(id: string) {
  return apiDownloadUrl(`/documents/${id}/download`);
}

export function documentDownloadPath(id: string) {
  return `/documents/${id}/download`;
}
