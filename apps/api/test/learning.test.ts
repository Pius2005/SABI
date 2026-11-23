import { describe, expect, it } from 'vitest';
import { bearer, loginLearner, makeApp } from './helpers';

const LESSON = 'hold-and-switch-on';

describe('progress, sync and practice', () => {
  it('starts empty and records the furthest step', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550201');
    const auth = bearer(session.accessToken);

    const empty = await ctx.api.get('/api/v1/progress').set('Authorization', auth);
    expect(empty.status).toBe(200);
    expect(empty.body.progress).toEqual([]);

    const first = await ctx.api
      .put(`/api/v1/progress/${LESSON}`)
      .set('Authorization', auth)
      .send({ stepIndex: 2 });
    expect(first.status).toBe(200);
    expect(first.body.progress.stepIndex).toBe(2);

    const backwards = await ctx.api
      .put(`/api/v1/progress/${LESSON}`)
      .set('Authorization', auth)
      .send({ stepIndex: 0 });
    expect(backwards.body.progress.stepIndex).toBe(2);
  });

  it('marks completion and counts stuck moments', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550202');
    const auth = bearer(session.accessToken);

    await ctx.api.put(`/api/v1/progress/${LESSON}`).set('Authorization', auth).send({ stepIndex: 1, stuck: true });
    const done = await ctx.api
      .put(`/api/v1/progress/${LESSON}`)
      .set('Authorization', auth)
      .send({ stepIndex: 3, completed: true, stuck: true });
    expect(done.status).toBe(200);
    expect(done.body.progress.completedAt).toBeTruthy();
    expect(done.body.progress.stuckCount).toBe(2);

    const list = await ctx.api.get('/api/v1/progress').set('Authorization', auth);
    expect(list.body.progress).toHaveLength(1);
    expect(list.body.progress[0].lessonSlug).toBe(LESSON);
  });

  it('clamps a step index past the end of the lesson', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550203');
    const auth = bearer(session.accessToken);
    const response = await ctx.api
      .put(`/api/v1/progress/${LESSON}`)
      .set('Authorization', auth)
      .send({ stepIndex: 25 });
    expect(response.status).toBe(200);
    const lesson = ctx.store.lesson(LESSON);
    expect(response.body.progress.stepIndex).toBe((lesson?.steps.length ?? 1) - 1);
  });

  it('validates progress input and rejects unknown lessons', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550204');
    const auth = bearer(session.accessToken);

    const invalid = await ctx.api
      .put(`/api/v1/progress/${LESSON}`)
      .set('Authorization', auth)
      .send({ stepIndex: 99 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION');

    const unknown = await ctx.api
      .put('/api/v1/progress/nope')
      .set('Authorization', auth)
      .send({ stepIndex: 0 });
    expect(unknown.status).toBe(404);
  });

  it('applies only newer offline sync rows', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550205');
    const auth = bearer(session.accessToken);

    const now = new Date().toISOString();
    const later = new Date(Date.now() + 60_000).toISOString();
    const older = new Date(Date.now() - 60_000).toISOString();

    const first = await ctx.api
      .post('/api/v1/progress/sync')
      .set('Authorization', auth)
      .send({
        items: [
          { lessonSlug: LESSON, stepIndex: 2, stuckCount: 1, updatedAt: now },
          { lessonSlug: 'charge-your-phone', stepIndex: 1, updatedAt: now },
        ],
      });
    expect(first.status).toBe(200);
    expect(first.body.applied).toBe(2);

    const stale = await ctx.api
      .post('/api/v1/progress/sync')
      .set('Authorization', auth)
      .send({ items: [{ lessonSlug: LESSON, stepIndex: 0, updatedAt: older }] });
    expect(stale.body.applied).toBe(0);
    expect(
      stale.body.progress.find((row: { lessonSlug: string }) => row.lessonSlug === LESSON).stepIndex,
    ).toBe(2);

    const fresh = await ctx.api
      .post('/api/v1/progress/sync')
      .set('Authorization', auth)
      .send({ items: [{ lessonSlug: LESSON, stepIndex: 3, completedAt: later, updatedAt: later }] });
    expect(fresh.body.applied).toBe(1);
    const row = fresh.body.progress.find((item: { lessonSlug: string }) => item.lessonSlug === LESSON);
    expect(row.stepIndex).toBe(3);
    expect(row.completedAt).toBe(later);
  });

  it('records a sandbox attempt', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550206');
    const auth = bearer(session.accessToken);

    const created = await ctx.api
      .post('/api/v1/sandbox/attempts')
      .set('Authorization', auth)
      .send({ taskId: 'sandbox.dialer.call', success: true, hintsUsed: 1 });
    expect(created.status).toBe(201);
    expect(created.body.ok).toBe(true);
    expect(ctx.store.data.sandboxAttempts).toHaveLength(1);
  });

  it('keeps progress private to the signed-in learner', async () => {
    const ctx = makeApp();
    const one = await loginLearner(ctx, '08055550207');
    const two = await loginLearner(ctx, '08055550208');

    await ctx.api
      .put(`/api/v1/progress/${LESSON}`)
      .set('Authorization', bearer(one.accessToken))
      .send({ stepIndex: 2 });

    const other = await ctx.api.get('/api/v1/progress').set('Authorization', bearer(two.accessToken));
    expect(other.body.progress).toEqual([]);
  });
});
