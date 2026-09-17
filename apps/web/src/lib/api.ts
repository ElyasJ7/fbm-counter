import type { ApiErrorBody } from '@fbm/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message;
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

let refreshInFlight: Promise<boolean> | null = null;

function isAuthPath(path: string) {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/logout')
  );
}

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody | T;

  if (!response.ok) {
    throw new ApiError(response.status, data as ApiErrorBody);
  }

  return data as T;
}

async function rawFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
  });
}

async function fetchWithAuthRetry(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const response = await rawFetch(path, init);

  if (response.status !== 401 || isAuthPath(path)) {
    return response;
  }

  const refreshed = await tryRefreshSession();
  if (!refreshed) {
    return response;
  }

  return rawFetch(path, init);
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetchWithAuthRetry(path, {
    ...options,
    headers,
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  return parseResponse<T>(response);
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestInit, 'body'> = {},
): Promise<T> {
  const response = await fetchWithAuthRetry(path, {
    ...options,
    method: options.method ?? 'POST',
    body: formData,
  });

  return parseResponse<T>(response);
}

export function apiDownloadUrl(path: string) {
  return `${API_BASE}${path}`;
}

export async function apiDownload(path: string): Promise<Response> {
  return fetchWithAuthRetry(path, { method: 'GET' });
}
