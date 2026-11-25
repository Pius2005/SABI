import { ApiError } from './api';

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

type Translate = (key: string, fallback?: string) => string;

const CODE_TO_KEY: Record<string, string> = {
  NETWORK: 'errors.network',
  UNAUTHORIZED: 'errors.unauthorized',
  INVALID_REFRESH: 'errors.unauthorized',
  NOT_FOUND: 'errors.notFound',
  LOCKED: 'auth.locked',
  INVALID_CODE: 'auth.invalidCode',
  INVALID_PHONE: 'auth.invalidPhone',
  CONSENT_REQUIRED: 'auth.agree',
  RESEND_COOLDOWN: 'auth.resendIn',
  VALIDATION: 'errors.generic',
};

export function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK') return t('errors.network');
    // The API's own sentence for a bad email/password. Left to the generic 401
    // wording below it reads "Please log in again", which is exactly what the
    // reader was already doing. No translated key exists for it, so the server
    // text is the honest source rather than an invented translation.
    if (error.code === 'INVALID_LOGIN' && error.message) return error.message;
    const key = CODE_TO_KEY[error.code];
    if (key) {
      if (error.code === 'RESEND_COOLDOWN' && error.retryAfter) {
        return t('auth.resendIn', 'Please wait').replace('{seconds}', String(error.retryAfter));
      }
      return t(key);
    }
    if (error.status === 401) return t('errors.unauthorized');
    if (error.status === 404) return t('errors.notFound');
    return error.message && !error.message.startsWith('errors.') ? error.message : t('errors.generic');
  }
  if (error instanceof Error && error.message && !error.message.startsWith('errors.')) return error.message;
  return t('errors.generic');
}

export function safeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export function relativeTime(value: string, now = Date.now()): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
