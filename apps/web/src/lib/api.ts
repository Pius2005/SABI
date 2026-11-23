import type { AuthTokens, Lang, PublicUser } from '@sabi/shared';
import { API_BASE } from './config';
import { clearSession, loadSession, saveSession, type StoredSession } from './storage';

export class ApiError extends Error {
  status: number;
  code: string;
  retryAfter?: number;
  fields?: Array<{ path: string; message: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    retryAfter?: number,
    fields?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.fields = fields;
  }
}

type SessionListener = (session: StoredSession | null) => void;
const listeners = new Set<SessionListener>();

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(session: StoredSession | null): void {
  for (const listener of listeners) listener(session);
}

export function currentSession(): StoredSession | null {
  return loadSession();
}

export function setSessionFromTokens(tokens: AuthTokens): StoredSession {
  const session: StoredSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: tokens.user,
  };
  saveSession(session);
  emit(session);
  return session;
}

export function updateSessionUser(user: PublicUser): void {
  const session = loadSession();
  if (!session) return;
  const next = { ...session, user };
  saveSession(next);
  emit(next);
}

export function clearAuth(): void {
  clearSession();
  emit(null);
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const session = loadSession();
    if (!session?.refreshToken) return false;
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (!response.ok) {
        clearAuth();
        return false;
      }
      const tokens = (await response.json()) as AuthTokens;
      setSessionFromTokens(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, auth = true, retry = true, signal } = options;
  const session = loadSession();
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (auth && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'errors.network');
  }

  if (response.status === 401 && auth && retry && session?.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed) return rawRequest(path, { ...options, retry: false });
  }
  return response;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await rawRequest(path, options);
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; retryAfter?: number; fields?: Array<{ path: string; message: string }> } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'ERROR',
      error?.message ?? 'errors.generic',
      error?.retryAfter,
      error?.fields,
    );
  }
  return data as T;
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await rawRequest(path, { auth: true });
  if (!response.ok) {
    throw new ApiError(response.status, 'DOWNLOAD', 'errors.generic');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface ServerConfig {
  appName: string;
  tagline: string;
  languages: Array<{ code: Lang; name: string; greeting: string }>;
  pilotMode: boolean;
  providers: { stt: string; tts: string; llm: string; sms: string };
  retention: { retainAudio: boolean; audioRetentionHours: number; transcriptRetentionDays: number };
  confThreshold: number;
  demo: boolean;
}

export function fetchConfig(): Promise<ServerConfig> {
  return apiFetch<ServerConfig>('/config', { auth: false });
}
