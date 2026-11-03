'use client';

/**
 * Centralised API client for MarketHub.
 *
 * - Uses same-origin relative /api/v1 in production.
 * - In local development the Next dev server (port 3000) talks to the API on
 *   port 4100, which is why a dev-only absolute base is derived at runtime.
 * - All mutations participate in the double-submit CSRF scheme by mirroring
 *   the non-HttpOnly `mh_csrf` cookie into the `x-csrf-token` header.
 */

function resolveBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const { hostname, port, protocol } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000') {
      return `${protocol}//${hostname}:4100/api/v1`;
    }
  }
  return '/api/v1';
}

export const API_BASE = resolveBase();

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

let csrfPromise: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  const existing = readCookie('mh_csrf');
  if (existing) return existing;
  if (!csrfPromise) {
    csrfPromise = fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) return null;
        return readCookie('mh_csrf');
      })
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'x-csrf-token': (await fetchCsrfToken()) ?? '',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Internal flag: prevents infinite refresh loops. */
  retried?: boolean;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) return message.filter(Boolean).join('. ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(options.headers ?? {}),
  };

  if (isMutation) {
    const token = await fetchCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }
  if (options.idempotencyKey) {
    headers['idempotency-key'] = options.idempotencyKey;
  }
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Unable to reach the MarketHub server. Check your connection.', 0);
  }

  if (response.status === 401 && !options.retried && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return api<T>(path, { ...options, retried: true });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('markethub:session-expired'));
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    throw new ApiError(
      extractMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
