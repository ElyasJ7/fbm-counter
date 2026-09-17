import type { AuditLogDto, PaginatedResponse } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export type AuditQuery = {
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
  actorId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
};

function toQuery(params: AuditQuery) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.action) query.set('action', params.action);
  if (params.actorId) query.set('actorId', params.actorId);
  if (params.entityId) query.set('entityId', params.entityId);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.search?.trim()) query.set('search', params.search.trim());
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export function fetchAuditLogs(params: AuditQuery = {}) {
  return apiRequest<PaginatedResponse<AuditLogDto>>(
    `/audit${toQuery(params)}`,
  );
}

export function fetchAuditLog(id: string) {
  return apiRequest<AuditLogDto>(`/audit/${id}`);
}

export function fetchAuditEntityTypes() {
  return apiRequest<{ data: string[] }>('/audit/entity-types');
}
