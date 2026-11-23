import type { Role } from '@sabi/shared';
import { APP_TAGLINE as SHARED_TAGLINE } from '@sabi/shared';

export const APP_NAME = (import.meta.env.VITE_APP_NAME || 'SABI').trim() || 'SABI';
export const APP_TAGLINE = SHARED_TAGLINE;
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '');
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
