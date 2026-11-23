import { describe, expect, it } from 'vitest';
import { ADMIN, bearer, loginLearner, loginStaff, makeApp } from './helpers';

describe('auth and session lifecycle', () => {
  it('exposes health and config without a token', async () => {
    const { api } = makeApp();
    const health = await api.get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);

    const config = await api.get('/api/v1/config');
    expect(config.status).toBe(200);
    expect(config.body.languages.map((l: { code: string }) => l.code)).toEqual(['en', 'yo', 'ig', 'pcm']);
    expect(config.body.retention.transcriptRetentionDays).toBeGreaterThan(0);
  });

  it('returns a structured 404 for unknown API routes', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects an invalid Nigerian phone number', async () => {
    const { api } = makeApp();
    const response = await api.post('/api/v1/auth/otp/request').send({ phone: '12345' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION');
  });

  it('signs up a new learner through the OTP flow', async () => {
    const ctx = makeApp();
    const requested = await ctx.api
      .post('/api/v1/auth/otp/request')
      .send({ phone: '08055550001', displayName: 'New Person', lang: 'yo' });
    expect(requested.status).toBe(200);
    expect(requested.body.devCode).toMatch(/^\d{6}$/);

    const verified = await ctx.api.post('/api/v1/auth/otp/verify').send({
      phone: '08055550001',
      code: requested.body.devCode,
      displayName: 'New Person',
      lang: 'yo',
      agree: true,
      goalPathSlug: 'whatsapp',
    });
    expect(verified.status).toBe(200);
    expect(verified.body.isNew).toBe(true);
    expect(verified.body.user.role).toBe('LEARNER');
    expect(verified.body.user.preferredLang).toBe('yo');
    expect(verified.body.user.goalPathSlug).toBe('whatsapp');
    expect(verified.body.user.phoneMasked).toBe('0805 *** 0001');
    expect(verified.body.accessToken).toBeTruthy();
    expect(verified.body.refreshToken).toBeTruthy();
    // Secrets are never part of a public user object.
    expect(verified.body.user.passwordHash).toBeUndefined();
    expect(verified.body.user.phoneEnc).toBeUndefined();

    const me = await ctx.api.get('/api/v1/me').set('Authorization', bearer(verified.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toBe('New Person');
    expect(me.body.consents.map((c: { type: string }) => c.type)).toEqual(
      expect.arrayContaining(['terms', 'privacy', 'ai_notice']),
    );
  });

  it('requires consent before creating an account', async () => {
    const ctx = makeApp();
    const requested = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055550002' });
    const verified = await ctx.api.post('/api/v1/auth/otp/verify').send({
      phone: '08055550002',
      code: requested.body.devCode,
      agree: false,
    });
    expect(verified.status).toBe(400);
    expect(verified.body.error.code).toBe('CONSENT_REQUIRED');
  });

  it('rejects a wrong code and locks after five tries', async () => {
    const ctx = makeApp();
    const requested = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055550003' });
    const correct = requested.body.devCode as string;
    const wrong = correct === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await ctx.api
        .post('/api/v1/auth/otp/verify')
        .send({ phone: '08055550003', code: wrong, agree: true });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CODE');
    }

    const locked = await ctx.api
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '08055550003', code: correct, agree: true });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('LOCKED');
  });

  it('expires an old code instead of accepting it', async () => {
    const ctx = makeApp();
    const requested = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055550004' });
    const otp = ctx.store.data.otps.find((row) => row.codeHash && row.attempts === 0);
    expect(otp).toBeTruthy();
    if (otp) otp.expiresAt = new Date(Date.now() - 60_000).toISOString();

    const verified = await ctx.api
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '08055550004', code: requested.body.devCode, agree: true });
    expect(verified.status).toBe(400);
    expect(verified.body.error.code).toBe('EXPIRED');
  });

  it('logs in seeded staff, rejects a bad password and blocks a learner', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    expect(admin.user.role).toBe('ADMIN');

    const bad = await ctx.api.post('/api/v1/auth/login').send({ email: ADMIN.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_LOGIN');

    const learner = await loginLearner(ctx, '08055550005');
    const learnerOnStaffLogin = await ctx.api
      .post('/api/v1/auth/login')
      .send({ email: 'learner@sabi.app', password: 'whatever' });
    expect(learnerOnStaffLogin.status).toBe(401);
    expect(learner.user.role).toBe('LEARNER');
  });

  it('refreshes a session once and revokes the used refresh token', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550006');

    const first = await ctx.api.post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();
    expect(first.body.refreshToken).not.toBe(session.refreshToken);

    const replay = await ctx.api.post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH');

    const usable = await ctx.api
      .get('/api/v1/me')
      .set('Authorization', bearer(first.body.accessToken));
    expect(usable.status).toBe(200);
  });

  it('revokes the refresh token on logout', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550007');
    const logout = await ctx.api.post('/api/v1/auth/logout').send({ refreshToken: session.refreshToken });
    expect(logout.status).toBe(200);
    const refresh = await ctx.api.post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('rejects missing and tampered access tokens', async () => {
    const ctx = makeApp();
    const missing = await ctx.api.get('/api/v1/me');
    expect(missing.status).toBe(401);

    const tampered = await ctx.api.get('/api/v1/me').set('Authorization', bearer('not-a-real-token'));
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.code).toBe('UNAUTHORIZED');
  });

  it('enforces the per-account staff login lockout', async () => {
    const ctx = makeApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await ctx.api
        .post('/api/v1/auth/login')
        .send({ email: 'facilitator@sabi.app', password: 'definitely-wrong' });
      expect(response.status).toBe(401);
    }
    const locked = await ctx.api
      .post('/api/v1/auth/login')
      .send({ email: 'facilitator@sabi.app', password: 'Teach123!' });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('LOCKED');
  });
});
