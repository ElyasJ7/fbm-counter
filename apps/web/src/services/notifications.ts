import type { NotificationDto, PaginatedResponse } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export function fetchNotifications(params: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
} = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.unreadOnly) query.set('unreadOnly', '1');
  const qs = query.toString();
  return apiRequest<PaginatedResponse<NotificationDto>>(
    `/notifications${qs ? `?${qs}` : ''}`,
  );
}

export function fetchUnreadNotificationCount() {
  return apiRequest<{ count: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiRequest<NotificationDto>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ success: boolean; updated: number }>(
    '/notifications/read-all',
    { method: 'POST' },
  );
}
