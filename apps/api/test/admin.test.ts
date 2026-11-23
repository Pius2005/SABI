import { describe, expect, it } from 'vitest';
import { ADMIN, FACILITATOR, bearer, loginLearner, loginStaff, makeApp } from './helpers';

describe('admin console', () => {
  it('reports analytics with translation coverage for all four languages', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    const response = await ctx.api.get('/api/v1/admin/analytics').set('Authorization', bearer(admin.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.analytics.learners).toBeGreaterThan(0);
    expect(response.body.analytics.scamChecks).toBeGreaterThan(0);
    expect(Object.keys(response.body.analytics.translationCoverage)).toEqual(['en', 'yo', 'ig', 'pcm']);
    expect(response.body.analytics.translationCoverage.en.approved).toBeGreaterThan(0);
  });

  it('lists users without leaking credentials', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    const response = await ctx.api.get('/api/v1/admin/users').set('Authorization', bearer(admin.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.users.length).toBeGreaterThan(5);
    for (const user of response.body.users) {
      expect(user.passwordHash).toBeUndefined();
      expect(user.phoneEnc).toBeUndefined();
      expect(user.phoneHash).toBeUndefined();
    }
  });

  it('pages and filters translations', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    const auth = bearer(admin.accessToken);

    const page = await ctx.api.get('/api/v1/admin/translations?limit=10&page=1').set('Authorization', auth);
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(10);
    expect(page.body.total).toBeGreaterThan(10);
    expect(page.body.limit).toBe(10);

    const onlyYoruba = await ctx.api
      .get('/api/v1/admin/translations?lang=yo&limit=100')
      .set('Authorization', auth);
    expect(onlyYoruba.body.items.every((row: { lang: string }) => row.lang === 'yo')).toBe(true);
  });

  it('approves a translation', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    const auth = bearer(admin.accessToken);

    const patched = await ctx.api
      .patch('/api/v1/admin/translations')
      .set('Authorization', auth)
      .send({ key: 'auth.title', lang: 'yo', text: 'Wọlé', status: 'approved' });
    expect(patched.status).toBe(200);
    expect(patched.body.translation.status).toBe('approved');
    expect(patched.body.translation.reviewerId).toBeTruthy();
  });

  it('no longer offers audio generation for a translation', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    const response = await ctx.api
      .post('/api/v1/admin/audio/generate')
      .set('Authorization', bearer(admin.accessToken))
      .send({ key: 'auth.title', lang: 'ig' });
    expect(response.status).toBe(404);
  });

  it('creates and deletes a scam example', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    const auth = bearer(admin.accessToken);

    const created = await ctx.api
      .post('/api/v1/admin/scam-examples')
      .set('Authorization', auth)
      .send({
        type: 'phishing',
        lang: 'ig',
        text: 'Biko zipu PIN gi na nọmba a.',
        isScam: true,
        redFlags: ['credential_request'],
      });
    expect(created.status).toBe(201);

    const listed = await ctx.api.get('/api/v1/admin/scam-examples').set('Authorization', auth);
    expect(listed.body.examples.some((example: { id: string }) => example.id === created.body.example.id)).toBe(true);

    const removed = await ctx.api
      .delete(`/api/v1/admin/scam-examples/${created.body.example.id}`)
      .set('Authorization', auth);
    expect(removed.status).toBe(200);

    const again = await ctx.api
      .delete(`/api/v1/admin/scam-examples/${created.body.example.id}`)
      .set('Authorization', auth);
    expect(again.status).toBe(404);
  });

  it('exposes audit logs and the glossary', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, ADMIN.email, ADMIN.password);
    const auth = bearer(admin.accessToken);

    const logs = await ctx.api.get('/api/v1/admin/audit-logs').set('Authorization', auth);
    expect(logs.status).toBe(200);
    expect(logs.body.logs.length).toBeGreaterThan(0);

    const glossary = await ctx.api.get('/api/v1/admin/glossary').set('Authorization', auth);
    expect(glossary.body.glossary.length).toBeGreaterThan(0);
  });

  it('keeps the admin console away from facilitators and learners', async () => {
    const ctx = makeApp();
    const facilitator = await loginStaff(ctx, FACILITATOR.email, FACILITATOR.password);
    const learner = await loginLearner(ctx, '08055550501');

    const byFacilitator = await ctx.api
      .get('/api/v1/admin/analytics')
      .set('Authorization', bearer(facilitator.accessToken));
    expect(byFacilitator.status).toBe(403);

    const byLearner = await ctx.api
      .get('/api/v1/admin/users')
      .set('Authorization', bearer(learner.accessToken));
    expect(byLearner.status).toBe(403);
  });
});
