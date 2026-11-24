import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { bearer, loginLearner, loginStaff, makeApp } from './helpers';

describe('security boundaries', () => {
  it('sets hardened headers and hides the framework', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects a foreign browser origin', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/health').set('Origin', 'http://evil.example');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CORS');
  });

  it('allows the configured web origin', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('allows every origin listed in WEB_ORIGIN', async () => {
    const { api } = makeApp({ webOrigin: 'https://sabi.vercel.app, https://sabi.example.com' });
    for (const origin of ['https://sabi.vercel.app', 'https://sabi.example.com']) {
      const response = await api.get('/api/v1/health').set('Origin', origin);
      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('rejects a token signed with another secret', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550601');
    const forged = jwt.sign({ sub: session.user.id, role: 'ADMIN', typ: 'access' }, 'not-the-real-secret', {
      expiresIn: '30m',
    });
    const response = await ctx.api.get('/api/v1/me').set('Authorization', bearer(forged));
    expect(response.status).toBe(401);
  });

  it('rejects a refresh token used as an access token', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550602');
    const response = await ctx.api.get('/api/v1/me').set('Authorization', bearer(session.refreshToken));
    expect(response.status).toBe(401);
  });

  it('never reveals why a staff login failed', async () => {
    const ctx = makeApp();
    const unknown = await ctx.api
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@sabi.app', password: 'whatever-123' });
    const wrong = await ctx.api
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sabi.app', password: 'whatever-123' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('returns the account export with the decrypted phone for the owner only', async () => {
    const ctx = makeApp();
    const learner = await loginLearner(ctx, '08055550603');
    const response = await ctx.api
      .get('/api/v1/me/export')
      .set('Authorization', bearer(learner.accessToken));
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body.profile.phone).toBe('08055550603');
    expect(response.body.profile.passwordHash).toBeUndefined();
    expect(response.body.exportedAt).toBeTruthy();
  });

  it('seeds content but no demo accounts or demo data in production', async () => {
    const ctx = makeApp({ nodeEnv: 'production' });
    expect(ctx.store.data.users).toHaveLength(0);
    expect(ctx.store.data.paths.length).toBeGreaterThan(0);
    expect(ctx.store.data.lessons.length).toBeGreaterThan(0);

    const demo = await ctx.api
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sabi.app', password: 'Admin123!' });
    expect(demo.status).toBe(401);
  });

  it('creates the first administrator from ADMIN_EMAIL and ADMIN_PASSWORD in production', async () => {
    const ctx = makeApp({
      nodeEnv: 'production',
      adminEmail: 'Owner@Sabi.app',
      adminPassword: 'pilot-password-1234',
    });
    expect(ctx.store.data.users).toHaveLength(1);
    const login = await ctx.api
      .post('/api/v1/auth/login')
      .send({ email: 'owner@sabi.app', password: 'pilot-password-1234' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('ADMIN');
  });

  it('does not expose a development OTP code in production', async () => {
    const ctx = makeApp({ nodeEnv: 'production' });
    const response = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055550604' });
    expect(response.status).toBe(200);
    expect(response.body.devCode).toBeUndefined();
    expect(response.body.ok).toBe(true);

    const config = await ctx.api.get('/api/v1/config');
    expect(config.body.demo).toBe(false);
  });

  it('throttles repeated OTP requests for the same number', async () => {
    const ctx = makeApp();
    const first = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055550605' });
    expect(first.status).toBe(200);
    const second = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055550605' });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('RESEND_COOLDOWN');
    expect(second.body.error.retryAfter).toBeGreaterThan(0);
  });

  it('stores only hashed or encrypted phone data for a new account', async () => {
    const ctx = makeApp();
    await loginLearner(ctx, '08055550606');
    const user = ctx.store.data.users.find((row) => row.phoneMasked === '0805 *** 0606');
    expect(user).toBeTruthy();
    expect(user?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
    expect(user?.phoneEnc).not.toContain('08055550606');
    expect(JSON.stringify(ctx.store.data.users)).not.toContain('08055550606');
  });

  it('deletes an account and revokes its data', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550607');
    const auth = bearer(session.accessToken);

    const removed = await ctx.api.delete('/api/v1/me').set('Authorization', auth);
    expect(removed.status).toBe(200);

    const after = await ctx.api.get('/api/v1/me').set('Authorization', auth);
    expect(after.status).toBe(401);

    const user = ctx.store.data.users.find((row) => row.id === session.user.id);
    expect(user?.deletedAt).toBeTruthy();
    expect(user?.phoneEnc).toBeNull();
    expect(user?.phoneHash).toBeNull();
    expect(ctx.store.data.refreshTokens.some((token) => token.userId === session.user.id)).toBe(false);
  });

  it('requires a token for every admin route', async () => {
    const { api } = makeApp();
    for (const path of ['/api/v1/admin/analytics', '/api/v1/admin/users', '/api/v1/admin/audit-logs']) {
      const response = await api.get(path);
      expect(response.status).toBe(401);
    }
  });

  it('refuses profile updates outside the allowed schema', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, 'admin@sabi.app', 'Admin123!');
    const response = await ctx.api
      .patch('/api/v1/me')
      .set('Authorization', bearer(admin.accessToken))
      .send({ role: 'LEARNER' });
    expect(response.status).toBe(400);
    expect(ctx.store.userById(admin.user.id)?.role).toBe('ADMIN');
  });
});
