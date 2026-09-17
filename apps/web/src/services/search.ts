import type { SearchResponseDto } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export function searchGlobal(query: string) {
  const q = query.trim();
  const params = new URLSearchParams({ q });
  return apiRequest<SearchResponseDto>(`/search?${params.toString()}`);
}
