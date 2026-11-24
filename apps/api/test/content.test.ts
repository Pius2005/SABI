import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bearer, loginLearner, makeApp } from './helpers';

describe('content and localization', () => {
  it('lists every learning path publicly', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/paths');
    expect(response.status).toBe(200);
    expect(response.body.paths.length).toBe(6);
    for (const path of response.body.paths) {
      expect(path.slug).toBeTruthy();
      expect(path.title).toBeTruthy();
      expect(path.lessonCount).toBeGreaterThan(0);
    }
  });

  it('serves English UI strings without a translation notice', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/ui-strings/en');
    expect(response.status).toBe(200);
    expect(response.body.lang).toBe('en');
    expect(response.body.notice).toBe(false);
    expect(Object.keys(response.body.strings).length).toBeGreaterThan(300);
    expect(response.body.strings['auth.title']).toBeTruthy();
  });

  it('serves Yoruba strings with the pilot translation notice', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/ui-strings/yo');
    expect(response.status).toBe(200);
    expect(response.body.lang).toBe('yo');
    expect(response.body.notice).toBe(true);
    expect(Object.keys(response.body.strings).length).toBeGreaterThan(200);
  });

  it('falls back to English for an unknown language code', async () => {
    const { api } = makeApp();
    const response = await api.get('/api/v1/ui-strings/xx');
    expect(response.status).toBe(200);
    expect(response.body.lang).toBe('en');
  });

  it('requires a login for path detail', async () => {
    const ctx = makeApp();
    const anonymous = await ctx.api.get('/api/v1/paths/phone-basics');
    expect(anonymous.status).toBe(401);

    const session = await loginLearner(ctx, '08055550101');
    const response = await ctx.api
      .get('/api/v1/paths/phone-basics')
      .set('Authorization', bearer(session.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.path.slug).toBe('phone-basics');
    expect(response.body.path.lessons.length).toBeGreaterThan(0);
    expect(response.body.path.lessons[0].locked).toBe(false);
  });

  it('returns a lesson with steps, visuals and a self check', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550102');
    const paths = await ctx.api.get('/api/v1/paths');
    const firstPath = paths.body.paths[0].slug;
    const detail = await ctx.api
      .get(`/api/v1/paths/${firstPath}`)
      .set('Authorization', bearer(session.accessToken));
    const lessonSlug = detail.body.path.lessons[0].slug;

    const lesson = await ctx.api
      .get(`/api/v1/lessons/${lessonSlug}`)
      .set('Authorization', bearer(session.accessToken));
    expect(lesson.status).toBe(200);
    expect(lesson.body.lesson.steps.length).toBeGreaterThan(0);
    for (const step of lesson.body.lesson.steps) {
      expect(step.text).toBeTruthy();
      expect(step.alt).toBeTruthy();
      expect(step.visual).toBeTruthy();
    }
    expect(lesson.body.lesson.selfCheck).toBeTruthy();
  });

  it('returns an offline bundle with the lesson, path and UI strings', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550103');
    const lesson = await ctx.api
      .get('/api/v1/lessons/hold-and-switch-on/bundle?lang=yo')
      .set('Authorization', bearer(session.accessToken));
    expect(lesson.status).toBe(200);
    expect(lesson.body.lesson.slug).toBe('hold-and-switch-on');
    expect(lesson.body.lesson.lang).toBe('yo');
    expect(lesson.body.path).toBeTruthy();
    expect(Object.keys(lesson.body.strings).length).toBeGreaterThan(200);
    expect(lesson.body.downloadedAt).toBeTruthy();
  });

  it('404s for an unknown lesson and an unknown path', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550104');
    const lesson = await ctx.api
      .get('/api/v1/lessons/not-a-lesson')
      .set('Authorization', bearer(session.accessToken));
    expect(lesson.status).toBe(404);
    expect(lesson.body.error.code).toBe('NOT_FOUND');

    const path = await ctx.api
      .get('/api/v1/paths/not-a-path')
      .set('Authorization', bearer(session.accessToken));
    expect(path.status).toBe(404);
  });

  it('serves the built PWA shell for a client-side route', async () => {
    // The suite runs before `npm run build`, so serve a directory this test owns
    // instead of relying on apps/web/dist already existing.
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'sabi-dist-'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>SABI shell</title>');
    try {
      const { api } = makeApp({}, { webDist: dist });
      const response = await api.get('/paths');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('SABI shell');

      // An unknown API route must answer as an API, not with the HTML shell.
      const unknownApi = await api.get('/api/v1/not-a-route');
      expect(unknownApi.status).toBe(404);
      expect(unknownApi.body.error.code).toBe('NOT_FOUND');
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it('does not serve a shell when there is no build to serve', async () => {
    const missing = path.join(os.tmpdir(), 'sabi-no-dist', String(Date.now()));
    const { api } = makeApp({}, { webDist: missing });
    const response = await api.get('/paths');
    expect(response.status).toBe(404);
  });
});
