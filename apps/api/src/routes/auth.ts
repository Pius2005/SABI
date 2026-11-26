import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { Lang } from '@sabi/shared';
import type { Env } from '../env';
import type { Store } from '../store';
import { hashCode, hashPhone, hashToken, isValidNgPhone, normalizePhone, otpCode, encryptPhone, maskPhone } from '../crypto';
import { issueTokens, publicUser } from '../auth';
import { fail, handleZod } from '../http';
import { getSmsProvider } from '../providers';
import type { DbUser } from '../db-types';

const phoneSchema = z.string().min(7).max(20).refine(isValidNgPhone, 'Please enter a correct Nigerian phone number.');
const langSchema = z.enum(['en', 'yo', 'ig', 'pcm']).optional();

const staffAttempts = new Map<string, { count: number; until: number }>();

export function createAuthRouter(store: Store, env: Env): Router {
  const router = Router();
  // Demo mode: skip the gateway entirely and return the code to the browser so
  // the page can show it. The local mock provider also returns it, but only
  // outside production; this flag is the deliberate, documented switch.
  const demoOtp = env.demoOtp;

  router.post('/auth/otp/request', async (req, res) => {
    try {
      const body = z
        .object({ phone: phoneSchema, displayName: z.string().max(60).optional(), lang: langSchema })
        .parse(req.body);
      const phone = normalizePhone(body.phone);
      const phoneHash = hashPhone(phone, env);
      const existing = store.userByPhoneHash(phoneHash);
      if (existing && existing.role !== 'LEARNER') {
        fail(res, 400, 'USE_STAFF_LOGIN', 'This number belongs to a staff account. Please use staff login.');
        return;
      }

      const now = Date.now();
      let otp = store.data.otps.find((o) => o.phoneHash === phoneHash);
      if (otp?.lockedUntil && new Date(otp.lockedUntil).getTime() > now) {
        fail(res, 423, 'LOCKED', 'Too many tries. Please wait 15 minutes.', {
          retryAfter: Math.ceil((new Date(otp.lockedUntil).getTime() - now) / 1000),
        });
        return;
      }
      if (otp && now - new Date(otp.lastSentAt).getTime() < 60_000) {
        fail(res, 429, 'RESEND_COOLDOWN', 'Please wait before asking for another code.', {
          retryAfter: Math.ceil((60_000 - (now - new Date(otp.lastSentAt).getTime())) / 1000),
        });
        return;
      }

      const code = otpCode();
      if (!otp) {
        otp = {
          id: crypto.randomUUID(),
          phoneHash,
          codeHash: hashCode(code),
          attempts: 0,
          expiresAt: new Date(now + 5 * 60_000).toISOString(),
          lastSentAt: new Date(now).toISOString(),
          lockedUntil: null,
        };
        store.data.otps.push(otp);
      } else {
        otp.codeHash = hashCode(code);
        otp.attempts = 0;
        otp.expiresAt = new Date(now + 5 * 60_000).toISOString();
        otp.lastSentAt = new Date(now).toISOString();
        otp.lockedUntil = null;
      }
      store.save();

      if (!demoOtp) {
        try {
          await getSmsProvider(env).send(phone, `Your ${env.appName} code is ${code}. It expires in 5 minutes. Never share it with anyone.`);
        } catch (error) {
          // Nothing reached the phone, so do not keep a code the learner cannot
          // read and do not claim it was sent. Dropping it also clears the
          // cooldown, so a retry is allowed immediately.
          store.data.otps = store.data.otps.filter((o) => o.phoneHash !== phoneHash);
          store.save();
          console.error(`[api] OTP delivery failed: ${(error as Error).message}`);
          fail(res, 502, 'SMS_FAILED', 'We could not send the code. Please try again.');
          return;
        }
      }

      const devCode =
        demoOtp || (env.nodeEnv !== 'production' && env.smsProvider === 'mock') ? code : undefined;
      res.json({ ok: true, resendIn: 60, devCode });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not send the code.');
    }
  });

  router.post('/auth/otp/verify', (req, res) => {
    try {
      const body = z
        .object({
          phone: phoneSchema,
          code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
          displayName: z.string().min(1).max(60).optional(),
          lang: langSchema,
          goalPathSlug: z.string().max(60).optional(),
          agree: z.boolean().optional(),
          helper: z.boolean().optional(),
        })
        .parse(req.body);
      const phone = normalizePhone(body.phone);
      const phoneHash = hashPhone(phone, env);
      const otp = store.data.otps.find((o) => o.phoneHash === phoneHash);
      if (!otp) {
        fail(res, 400, 'INVALID_CODE', 'Please ask for a new code.');
        return;
      }
      if (otp.lockedUntil && new Date(otp.lockedUntil).getTime() > Date.now()) {
        fail(res, 423, 'LOCKED', 'Too many tries. Please wait 15 minutes.');
        return;
      }
      if (new Date(otp.expiresAt).getTime() < Date.now()) {
        fail(res, 400, 'EXPIRED', 'That code has expired. Please ask for a new one.');
        return;
      }
      if (otp.codeHash !== hashCode(body.code)) {
        otp.attempts += 1;
        if (otp.attempts >= 5) otp.lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
        store.save();
        fail(res, 400, 'INVALID_CODE', 'That code is not correct. Please try again.');
        return;
      }

      store.data.otps = store.data.otps.filter((o) => o.phoneHash !== phoneHash);
      let user = store.userByPhoneHash(phoneHash);
      let isNew = false;
      if (!user) {
        if (body.agree !== true) {
          fail(res, 400, 'CONSENT_REQUIRED', 'Please agree to the privacy notice to continue.');
          return;
        }
        isNew = true;
        user = {
          id: crypto.randomUUID(),
          role: 'LEARNER',
          phoneEnc: encryptPhone(phone, env),
          phoneHash,
          phoneMasked: maskPhone(phone),
          email: null,
          passwordHash: null,
          displayName: body.displayName?.trim() || 'Friend',
          preferredLang: (body.lang as Lang) || 'en',
          textSize: 'large',
          theme: 'light',
          reduceMotion: false,
          goalPathSlug: body.goalPathSlug ?? null,
          createdAt: new Date().toISOString(),
          deletedAt: null,
        };
        store.data.users.push(user);
        for (const type of ['terms', 'privacy', 'ai_notice']) {
          store.data.consents.push({
            id: crypto.randomUUID(),
            userId: user.id,
            type,
            granted: true,
            givenBy: null,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (body.goalPathSlug) user.goalPathSlug = body.goalPathSlug;
      if (body.displayName) user.displayName = body.displayName.trim();
      if (body.lang) user.preferredLang = body.lang as Lang;
      store.audit(user.id, isNew ? 'signup' : 'login_otp', 'user', user.id, { helper: Boolean(body.helper) });
      store.save();
      res.json({ ...issueTokens(user, store, env), isNew });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not verify the code.');
    }
  });

  router.post('/auth/login', (req, res) => {
    try {
      const body = z
        .object({ email: z.string().email('Enter a valid email.'), password: z.string().min(6).max(200) })
        .parse(req.body);
      const key = body.email.toLowerCase();
      const attempt = staffAttempts.get(key);
      if (attempt && attempt.until > Date.now() && attempt.count >= 5) {
        fail(res, 423, 'LOCKED', 'Too many tries. Please wait 15 minutes.');
        return;
      }
      const user = store.userByEmail(key);
      if (!user || !user.passwordHash || !['ADMIN', 'FACILITATOR', 'FAMILY'].includes(user.role)) {
        fail(res, 401, 'INVALID_LOGIN', 'Email or password is not correct.');
        return;
      }
      if (!bcrypt.compareSync(body.password, user.passwordHash)) {
        const next = { count: (attempt?.count ?? 0) + 1, until: Date.now() + 15 * 60_000 };
        staffAttempts.set(key, next);
        fail(res, 401, 'INVALID_LOGIN', 'Email or password is not correct.');
        return;
      }
      staffAttempts.delete(key);
      store.audit(user.id, 'login_staff', 'user', user.id, null);
      store.save();
      res.json(issueTokens(user, store, env));
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not log in.');
    }
  });

  router.post('/auth/refresh', (req, res) => {
    try {
      const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
      const tokenHash = hashToken(body.refreshToken);
      const row = store.data.refreshTokens.find((t) => t.tokenHash === tokenHash && !t.revokedAt);
      if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
        fail(res, 401, 'INVALID_REFRESH', 'Please log in again.');
        return;
      }
      const user = store.userById(row.userId);
      if (!user) {
        fail(res, 401, 'INVALID_REFRESH', 'Please log in again.');
        return;
      }
      row.revokedAt = new Date().toISOString();
      res.json(issueTokens(user, store, env));
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not refresh the session.');
    }
  });

  router.post('/auth/logout', (req, res) => {
    const body = z.object({ refreshToken: z.string().optional() }).safeParse(req.body);
    const token = body.success ? body.data.refreshToken : undefined;
    if (token) {
      const tokenHash = hashToken(token);
      for (const row of store.data.refreshTokens) {
        if (row.tokenHash === tokenHash) row.revokedAt = new Date().toISOString();
      }
    }
    store.save();
    res.json({ ok: true });
  });

  return router;
}

export function seedPhoneFor(user: DbUser): string | null {
  return user.phoneMasked;
}
