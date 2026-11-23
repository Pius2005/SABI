import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthTokens, Lang, PublicUser, Role } from '@sabi/shared';
import type { DbUser } from './db-types';
import type { Env } from './env';
import type { Store } from './store';
import { randomToken, hashToken } from './crypto';

const ACCESS_TTL = '30m';
const REFRESH_DAYS = 30;

export function publicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    preferredLang: user.preferredLang,
    textSize: user.textSize,
    theme: user.theme,
    voiceSpeed: user.voiceSpeed,
    autoRead: user.autoRead,
    reduceMotion: user.reduceMotion,
    phoneMasked: user.phoneMasked,
    email: user.email,
    goalPathSlug: user.goalPathSlug,
    createdAt: user.createdAt,
  };
}

export function issueTokens(user: DbUser, store: Store, env: Env): AuthTokens {
  const accessToken = jwt.sign({ sub: user.id, role: user.role, typ: 'access' }, env.jwtAccessSecret, {
    expiresIn: ACCESS_TTL,
  });
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  store.data.refreshTokens.push({
    id: randomToken(12),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  });
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  store.data.refreshTokens = store.data.refreshTokens.filter((t) => t.createdAt > cutoff || t.revokedAt === null);
  store.save();
  return { accessToken, refreshToken, user: publicUser(user) };
}

export function authenticate(store: Store, env: Env): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please log in.' } });
      return;
    }
    try {
      const payload = jwt.verify(token, env.jwtAccessSecret) as { sub?: string; typ?: string };
      if (!payload.sub || payload.typ !== 'access') throw new Error('bad token');
      const user = store.userById(payload.sub);
      if (!user) throw new Error('no user');
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please log in again.' } });
    }
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please log in.' } });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this.' } });
      return;
    }
    next();
  };
}

export function isStaff(user: DbUser | undefined): boolean {
  return user?.role === 'FACILITATOR' || user?.role === 'ADMIN';
}

export function normalizeLang(value: unknown, fallback: Lang = 'en'): Lang {
  return value === 'yo' || value === 'ig' || value === 'pcm' || value === 'en' ? value : fallback;
}

export function parseCookies(_req: Request): Record<string, string> {
  return {};
}
