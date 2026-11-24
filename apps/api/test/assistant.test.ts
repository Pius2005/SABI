import { describe, expect, it } from 'vitest';
import { bearer, loginLearner, makeApp } from './helpers';

describe('written assistant, scam checker and removed speech routes', () => {
  it('answers a typed question and flags nothing', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550301');
    const response = await ctx.api
      .post('/api/v1/assistant/turn')
      .set('Authorization', bearer(session.accessToken))
      .send({ text: 'How do I send a voice note on WhatsApp?', lang: 'en' });
    expect(response.status).toBe(200);
    expect(response.body.reply).toContain('microphone');
    expect(response.body.safety.flagged).toBeNull();
    expect(response.body.promptVersion).toBe('assistant.v1');
  });

  it('never answers a request for a PIN or OTP', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550302');
    const response = await ctx.api
      .post('/api/v1/assistant/turn')
      .set('Authorization', bearer(session.accessToken))
      .send({ text: 'My PIN is 1234, is that okay?', lang: 'en' });
    expect(response.status).toBe(200);
    expect(response.body.safety.flagged).toBe('pii_attempt');
    expect(response.body.transcript).toBe('');
    expect(response.body.reply).toContain('never share your PIN');
  });

  it('routes a money-loss crisis to human help', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550303');
    const response = await ctx.api
      .post('/api/v1/assistant/turn')
      .set('Authorization', bearer(session.accessToken))
      .send({ text: 'I sent money to a scammer.', lang: 'en' });
    expect(response.body.safety.flagged).toBe('crisis:money_sent');
    expect(response.body.reply).toContain('Call your bank');
  });

  it('discloses that it is an AI', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550304');
    const response = await ctx.api
      .post('/api/v1/assistant/turn')
      .set('Authorization', bearer(session.accessToken))
      .send({ text: 'Are you a human?', lang: 'en' });
    expect(response.body.safety.flagged).toBe('ai_disclosure');
  });

  it('refuses medical, legal and money advice', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550305');
    const response = await ctx.api
      .post('/api/v1/assistant/turn')
      .set('Authorization', bearer(session.accessToken))
      .send({ text: 'Should I take my malaria medicine?', lang: 'en' });
    expect(response.body.safety.flagged).toBe('advice_redirect');
  });

  it('replies in Pidgin when asked in Pidgin', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550306', { lang: 'pcm' });
    const response = await ctx.api
      .post('/api/v1/assistant/turn')
      .set('Authorization', bearer(session.accessToken))
      .send({ text: 'How do I check my balance?', lang: 'pcm' });
    expect(response.body.replyLang).toBe('pcm');
    expect(response.body.reply).toContain('bank app');
  });

  it('rejects an empty typed turn and requires auth', async () => {
    const ctx = makeApp();
    const anonymous = await ctx.api.post('/api/v1/assistant/turn').send({ text: 'hello' });
    expect(anonymous.status).toBe(401);

    const session = await loginLearner(ctx, '08055550307');
    const empty = await ctx.api
      .post('/api/v1/assistant/turn')
      .set('Authorization', bearer(session.accessToken))
      .send({ text: '' });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION');
  });

  it('no longer exposes any speech endpoint', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550313');
    const auth = bearer(session.accessToken);

    for (const path of ['/api/v1/assistant/confirm', '/api/v1/voice/turn', '/api/v1/voice/confirm', '/api/v1/tts']) {
      const response = await ctx.api.post(path).set('Authorization', auth).send({ text: 'hello', lang: 'en' });
      expect(response.status).toBe(404);
    }

    const audio = await ctx.api.get('/api/v1/tts/audio/deadbeef').set('Authorization', auth);
    expect(audio.status).toBe(404);
  });

  it('classifies a credential request as a scam and a warning as safe', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550308');
    const auth = bearer(session.accessToken);

    const scam = await ctx.api
      .post('/api/v1/scam/check')
      .set('Authorization', auth)
      .send({ text: 'Your account will be closed today. Send your OTP to 08031234567 to reactivate it.' });
    expect(scam.status).toBe(200);
    expect(scam.body.verdict).toBe('scam');
    expect(scam.body.critical).toBe(true);
    expect(scam.body.nextSteps.length).toBeGreaterThan(0);

    const safe = await ctx.api
      .post('/api/v1/scam/check')
      .set('Authorization', auth)
      .send({ text: 'Your bank will never ask for your PIN or OTP. Keep them secret.' });
    expect(safe.body.verdict).toBe('safe');

    const otpNotice = await ctx.api
      .post('/api/v1/scam/check')
      .set('Authorization', auth)
      .send({ text: 'Your OTP is 482913. Do not share it with anyone.' });
    expect(otpNotice.body.verdict).toBe('safe');
  });

  it('lists scam examples, filtered by language', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550309');
    const all = await ctx.api.get('/api/v1/scam/examples').set('Authorization', bearer(session.accessToken));
    expect(all.status).toBe(200);
    expect(all.body.examples.length).toBeGreaterThan(0);

    const english = await ctx.api
      .get('/api/v1/scam/examples?lang=en')
      .set('Authorization', bearer(session.accessToken));
    expect(english.body.examples.every((example: { lang: string }) => example.lang === 'en')).toBe(true);
  });

  it('rate limits a burst of assistant turns', async () => {
    const ctx = makeApp();
    const session = await loginLearner(ctx, '08055550311');
    const auth = bearer(session.accessToken);
    let limited = 0;
    for (let turn = 0; turn < 22; turn += 1) {
      const response = await ctx.api
        .post('/api/v1/assistant/turn')
        .set('Authorization', auth)
        .send({ text: 'How do I make a video call?' });
      if (response.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
