import { describe, expect, it } from 'vitest';
import { FAMILY, SEEDED_LEARNER_PHONE, bearer, loginLearner, loginStaff, makeApp } from './helpers';

describe('help requests, groups, family links and reminders', () => {
  it('lets a learner ask for help and a facilitator claim it', async () => {
    const ctx = makeApp();
    const learner = await loginLearner(ctx, SEEDED_LEARNER_PHONE);
    const facilitator = await loginStaff(ctx, 'facilitator@sabi.app', 'Teach123!');

    const created = await ctx.api
      .post('/api/v1/help-requests')
      .set('Authorization', bearer(learner.accessToken))
      .send({ type: 'call_back', context: { lessonSlug: 'make-a-phone-call' } });
    expect(created.status).toBe(201);
    expect(created.body.request.status).toBe('open');
    // No Nace key in tests, so the local rule set routes the request.
    expect(created.body.request.triage).toMatchObject({ route: 'facilitator', priority: 'now', source: 'local' });

    const list = await ctx.api
      .get('/api/v1/help-requests')
      .set('Authorization', bearer(facilitator.accessToken));
    expect(list.status).toBe(200);
    const mine = list.body.requests.find((r: { id: string }) => r.id === created.body.request.id);
    expect(mine).toBeTruthy();
    expect(mine.learnerName).toBeTruthy();

    const updated = await ctx.api
      .patch(`/api/v1/help-requests/${created.body.request.id}`)
      .set('Authorization', bearer(facilitator.accessToken))
      .send({ status: 'contacted' });
    expect(updated.status).toBe(200);
    expect(updated.body.request.contactedAt).toBeTruthy();
  });

  it('keeps the help queue closed to learners', async () => {
    const ctx = makeApp();
    const learner = await loginLearner(ctx, '08055550401');
    const response = await ctx.api.get('/api/v1/help-requests').set('Authorization', bearer(learner.accessToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('runs the facilitator group workflow', async () => {
    const ctx = makeApp();
    const facilitator = await loginStaff(ctx, 'facilitator@sabi.app', 'Teach123!');
    const auth = bearer(facilitator.accessToken);

    const groups = await ctx.api.get('/api/v1/groups').set('Authorization', auth);
    expect(groups.status).toBe(200);
    expect(groups.body.groups.length).toBeGreaterThan(0);

    const created = await ctx.api
      .post('/api/v1/groups')
      .set('Authorization', auth)
      .send({ name: 'Test Group', venue: 'Hall', schedule: 'Mondays, 9:00' });
    expect(created.status).toBe(201);
    const groupId = created.body.group.id;

    const member = await ctx.api
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', auth)
      .send({ name: 'New Learner', phone: '08055550404' });
    expect(member.status).toBe(201);

    const imported = await ctx.api
      .post(`/api/v1/groups/${groupId}/import`)
      .set('Authorization', auth)
      .send({ csv: 'name,phone\nAda,08055550405\nBad Row,\nChidi,07012345678' });
    expect(imported.status).toBe(200);
    expect(imported.body.added).toBe(2);
    expect(imported.body.failed).toHaveLength(1);

    const progress = await ctx.api.get(`/api/v1/groups/${groupId}/progress`).set('Authorization', auth);
    expect(progress.status).toBe(200);
    expect(progress.body.learners.length).toBe(3);

    const notes = await ctx.api
      .post(`/api/v1/groups/${groupId}/notes`)
      .set('Authorization', auth)
      .send({ notes: 'Slow down on banking.' });
    expect(notes.status).toBe(200);
  });

  it('refuses a group the facilitator does not own', async () => {
    const ctx = makeApp();
    const facilitator = await loginStaff(ctx, 'facilitator@sabi.app', 'Teach123!');
    const otherGroupId = ctx.store.data.groups[0].id;
    ctx.store.data.groups[0].facilitatorId = 'someone-else';

    const response = await ctx.api
      .post(`/api/v1/groups/${otherGroupId}/notes`)
      .set('Authorization', bearer(facilitator.accessToken))
      .send({ notes: 'should not work' });
    expect(response.status).toBe(403);
  });

  it('requires the family-link consent before inviting family', async () => {
    const ctx = makeApp();
    const learner = await loginLearner(ctx, '08030000003');
    const auth = bearer(learner.accessToken);

    const blocked = await ctx.api
      .post('/api/v1/family/invite')
      .set('Authorization', auth)
      .send({ phone: '08039999999' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CONSENT_REQUIRED');

    const consent = await ctx.api
      .post('/api/v1/me/consents')
      .set('Authorization', auth)
      .send({ type: 'family_link', granted: true });
    expect(consent.status).toBe(200);

    const invited = await ctx.api
      .post('/api/v1/family/invite')
      .set('Authorization', auth)
      .send({ phone: '08039999999', scopeProgress: true });
    expect(invited.status).toBe(201);
    expect(invited.body.link.status).toBe('pending');
  });

  it('completes the family accept, encourage and revoke flow', async () => {
    const ctx = makeApp();
    const learner = await loginLearner(ctx, '08030000003');
    await ctx.api
      .post('/api/v1/me/consents')
      .set('Authorization', bearer(learner.accessToken))
      .send({ type: 'family_link', granted: true });
    const invited = await ctx.api
      .post('/api/v1/family/invite')
      .set('Authorization', bearer(learner.accessToken))
      .send({ phone: '08039999999' });
    const linkId = invited.body.link.id;

    const family = await loginStaff(ctx, FAMILY.email, FAMILY.password);
    const familyAuth = bearer(family.accessToken);

    const learners = await ctx.api.get('/api/v1/family/learners').set('Authorization', familyAuth);
    expect(learners.status).toBe(200);
    expect(learners.body.links.some((l: { linkId: string }) => l.linkId === linkId)).toBe(true);

    const accepted = await ctx.api.post('/api/v1/family/accept').set('Authorization', familyAuth).send({ linkId });
    expect(accepted.status).toBe(200);
    expect(accepted.body.link.status).toBe('active');

    const encouraged = await ctx.api
      .post('/api/v1/family/encourage')
      .set('Authorization', familyAuth)
      .send({ linkId, message: 'Well done, keep going.' });
    expect(encouraged.status).toBe(200);

    const revoked = await ctx.api.delete(`/api/v1/family/${linkId}`).set('Authorization', familyAuth);
    expect(revoked.status).toBe(200);
    expect(ctx.store.data.familyLinks.find((l) => l.id === linkId)?.revokedAt).toBeTruthy();
  });

  it('stores a reminder and sends a test message to the real number', async () => {
    const ctx = makeApp();
    const learner = await loginLearner(ctx, SEEDED_LEARNER_PHONE);
    const auth = bearer(learner.accessToken);

    const saved = await ctx.api
      .put('/api/v1/reminders')
      .set('Authorization', auth)
      .send({
        channel: 'sms',
        weeklyDay: 2,
        hour: 10,
        quietStart: '20:00',
        quietEnd: '08:00',
        active: true,
      });
    expect(saved.status).toBe(200);
    expect(saved.body.reminder.weeklyDay).toBe(2);

    const fetched = await ctx.api.get('/api/v1/reminders').set('Authorization', auth);
    expect(fetched.body.reminder.channel).toBe('sms');

    const tested = await ctx.api.post('/api/v1/reminders/test').set('Authorization', auth);
    expect(tested.status).toBe(200);
    expect(tested.body.ok).toBe(true);

    const invalid = await ctx.api
      .put('/api/v1/reminders')
      .set('Authorization', auth)
      .send({ channel: 'sms', weeklyDay: 9, hour: 10, quietStart: '20:00', quietEnd: '08:00', active: true });
    expect(invalid.status).toBe(400);
  });

  it('will not send a test reminder to an account without a phone', async () => {
    const ctx = makeApp();
    const admin = await loginStaff(ctx, 'admin@sabi.app', 'Admin123!');
    const auth = bearer(admin.accessToken);
    await ctx.api
      .put('/api/v1/reminders')
      .set('Authorization', auth)
      .send({ channel: 'sms', weeklyDay: 1, hour: 9, quietStart: '20:00', quietEnd: '08:00', active: true });
    const tested = await ctx.api.post('/api/v1/reminders/test').set('Authorization', auth);
    expect(tested.status).toBe(400);
    expect(tested.body.error.code).toBe('NO_PHONE');
  });
});
