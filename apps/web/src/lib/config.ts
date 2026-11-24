import type { Role } from '@sabi/shared';
import { APP_TAGLINE as SHARED_TAGLINE } from '@sabi/shared';

export const APP_NAME = (import.meta.env.VITE_APP_NAME || 'SABI').trim() || 'SABI';
export const APP_TAGLINE = SHARED_TAGLINE;
// A relative path keeps the API on the same origin (one process serves both).
// An absolute URL lets the static web build be hosted elsewhere (for example
// Vercel) while the API runs on its own host; set WEB_ORIGIN on the API to the
// web origin so its CORS allow-list accepts the browser.
const configuredApiBase = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '');
export const API_BASE = configuredApiBase || '/api/v1';
export const IS_DEV = Boolean(import.meta.env.DEV);
export const IS_DEMO = IS_DEV;

export const DEMO_STAFF = [
  { role: 'Admin', email: 'admin@sabi.app', password: 'Admin123!' },
  { role: 'Facilitator', email: 'facilitator@sabi.app', password: 'Teach123!' },
  { role: 'Family', email: 'family@sabi.app', password: 'Family123!' },
];

export function homeForRole(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'FACILITATOR':
      return '/facilitator';
    case 'FAMILY':
      return '/family';
    default:
      return '/home';
  }
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'FACILITATOR':
      return 'Facilitator';
    case 'FAMILY':
      return 'Family member';
    default:
      return 'Learner';
  }
}
