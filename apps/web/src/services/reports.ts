import type {
  ReportExportType,
  ReportsSummaryDto,
} from '@fbm/shared';
import { apiDownloadUrl, apiRequest } from '../lib/api';

export type ReportsQuery = {
  from?: string;
  to?: string;
};

function toQueryString(
  params: ReportsQuery & {
    type?: ReportExportType;
    format?: 'csv' | 'pdf';
  },
) {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.type) query.set('type', params.type);
  if (params.format) query.set('format', params.format);
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export function fetchReports(params: ReportsQuery = {}) {
  return apiRequest<ReportsSummaryDto>(
    `/reports${toQueryString(params)}`,
  );
}

export function reportsExportUrl(
  type: ReportExportType,
  params: ReportsQuery & { format?: 'csv' | 'pdf' } = {},
) {
  return apiDownloadUrl(
    `/reports/export${toQueryString({ ...params, type })}`,
  );
}

export function reportsExportPath(
  type: ReportExportType,
  params: ReportsQuery & { format?: 'csv' | 'pdf' } = {},
) {
  return `/reports/export${toQueryString({ ...params, type })}`;
}
