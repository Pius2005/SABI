import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { loadEnv, type Env } from '../src/env';
import { Store } from '../src/store';

export interface TestContext {
  api: ReturnType<typeof request>;
  app: Express;
  store: Store;
  env: Env;
}

/** A fresh, fully seeded app with its own in-memory store. */
export function makeApp(overrides: Partial<Env> = {}): TestContext {
  const env = loadEnv({ nodeEnv: 'test', ...overrides });
  const store = Store.open({ memory: true, env });
  const app = createApp({ store, env });
  return { api: request(app), app, store, env };
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: string; displayName: string };
}

/** Log a learner in through the real OTP flow and return their tokens. */
export async function loginLearner(
  ctx: TestContext,
  phone: string,
  extra: { displayName?: string; lang?: string; agree?: boolean } = {},
): Promise<Session> {
  const first = await ctx.api.post('/api/v1/auth/otp/request').send({
    phone,
    displayName: extra.displayName ?? 'Test Learner',
    lang: extra.lang ?? 'en',
  });
  if (first.status !== 200) throw new Error(`otp request failed: ${first.status} ${JSON.stringify(first.body)}`);
  const code = first.body.devCode as string;
  if (!code) throw new Error('the mock SMS provider must expose a development code in tests');
  const second = await ctx.api.post('/api/v1/auth/otp/verify').send({
    phone,
    code,
    displayName: extra.displayName ?? 'Test Learner',
    lang: extra.lang ?? 'en',
    agree: extra.agree ?? true,
  });
  if (second.status !== 200) throw new Error(`otp verify failed: ${second.status} ${JSON.stringify(second.body)}`);
  return second.body as Session;
}

export async function loginStaff(
  ctx: TestContext,
  email = 'admin@sabi.app',
  password = 'Admin123!',
): Promise<Session> {
  const response = await ctx.api.post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`staff login failed: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body as Session;
}

export const SEEDED_LEARNER_PHONE = '08030000001';
export const FACILITATOR = { email: 'facilitator@sabi.app', password: 'Teach123!' };
export const ADMIN = { email: 'admin@sabi.app', password: 'Admin123!' };
export const FAMILY = { email: 'family@sabi.app', password: 'Family123!' };
