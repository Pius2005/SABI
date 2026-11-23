import type { DbUser } from './db-types';

declare global {
  namespace Express {
    interface Request {
      user?: DbUser;
    }
  }
}

export {};
