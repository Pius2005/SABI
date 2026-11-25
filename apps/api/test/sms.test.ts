import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { TermiiSms, toMsisdn } from '../src/providers';
import { makeApp } from './helpers';

const env = { smsApiKey: 'test-key', smsSenderId: 'Termii' } as Env;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Termii SMS delivery', () => {
  it('converts local and international numbers to an MSISDN', () => {
    expect(toMsisdn('08031234567')).toBe('2348031234567');
    expect(toMsisdn('2348031234567')).toBe('2348031234567');
    expect(toMsisdn('+234 803 123 4567')).toBe('2348031234567');
    expect(toMsisdn('8031234567')).toBe('2348031234567');
  });

  it('sends an international number with the configured sender', async () => {
    const sent: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body) as Record<string, unknown>);
      return new Response(JSON.stringify({ code: 'ok' }), { status: 200 });
    });

    await new TermiiSms(env).send('08031234567', 'Your SABI code is 123456.');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: '2348031234567',
      from: 'Termii',
      sms: 'Your SABI code is 123456.',
      type: 'plain',
      channel: 'generic',
      api_key: 'test-key',
    });
  });

  it('reports a rejected message to the caller', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ message: 'Sender id not approved' }), { status: 400 }),
    );

    await expect(new TermiiSms(env).send('08031234567', 'hi')).rejects.toThrow(/400.*Sender id not approved/);
  });
});

describe('OTP request when SMS cannot be delivered', () => {
  it('tells the learner instead of pretending the code was sent', async () => {
    vi.stubGlobal('fetch', async () => new Response('gateway down', { status: 500 }));
    const ctx = makeApp({ smsProvider: 'termii', smsApiKey: 'test-key' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055559999' });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('SMS_FAILED');
    expect(response.body.error.message).toBe('We could not send the code. Please try again.');
    expect(ctx.store.data.otps).toHaveLength(0);
  });

  it('allows an immediate retry, since the cooldown belongs to a delivered code', async () => {
    vi.stubGlobal('fetch', async () => new Response('gateway down', { status: 500 }));
    const ctx = makeApp({ smsProvider: 'termii', smsApiKey: 'test-key' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055559998' });

    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ code: 'ok' }), { status: 200 }));
    const retry = await ctx.api.post('/api/v1/auth/otp/request').send({ phone: '08055559998' });

    expect(retry.status).toBe(200);
    expect(retry.body.ok).toBe(true);
  });
});
