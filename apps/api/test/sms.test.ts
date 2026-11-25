import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { SendchampSms, TermiiSms, getSmsProvider, toMsisdn } from '../src/providers';
import { makeApp } from './helpers';

const env = { smsApiKey: 'test-key', smsSenderId: 'Termii', smsChannel: 'dnd' } as Env;

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
      channel: 'dnd',
      api_key: 'test-key',
    });
  });

  it('honours an explicit generic channel for accounts without DND', async () => {
    const sent: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body) as Record<string, unknown>);
      return new Response('{}', { status: 200 });
    });

    await new TermiiSms({ ...env, smsChannel: 'generic' } as Env).send('08031234567', 'hi');

    expect(sent[0]?.channel).toBe('generic');
  });

  it('reports a rejected message to the caller', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ message: 'Sender id not approved' }), { status: 400 }),
    );

    await expect(new TermiiSms(env).send('08031234567', 'hi')).rejects.toThrow(/400.*Sender id not approved/);
  });
});

describe('Sendchamp SMS delivery', () => {
  const champEnv = { smsApiKey: 'champ-key', smsSenderId: 'SABI', smsChannel: 'dnd' } as Env;

  it('is selected when SMS_PROVIDER=sendchamp and a key is present', () => {
    expect(getSmsProvider({ smsProvider: 'sendchamp', smsApiKey: 'champ-key' } as Env)).toBeInstanceOf(SendchampSms);
    expect(getSmsProvider({ smsProvider: 'sendchamp', smsApiKey: '' } as Env)).not.toBeInstanceOf(SendchampSms);
  });

  it('sends the MSISDN, bearer key and transactional route Sendchamp expects', async () => {
    const calls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', async (url: string, init: { headers: Record<string, string>; body: string }) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> });
      return new Response(JSON.stringify({ status: 'success', code: 200, data: { id: 'sms-1' } }), { status: 200 });
    });

    await new SendchampSms(champEnv).send('08031234567', 'Your SABI code is 123456.');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.sendchamp.com/api/v1/sms/send');
    expect(calls[0]?.headers.Authorization).toBe('Bearer champ-key');
    expect(calls[0]?.body).toMatchObject({
      to: ['2348031234567'],
      message: 'Your SABI code is 123456.',
      sender_name: 'SABI',
      route: 'dnd',
    });
  });

  it('maps the generic channel to Sendchamp\'s non_dnd route', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body) as Record<string, unknown>;
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    });

    await new SendchampSms({ ...champEnv, smsChannel: 'generic' } as Env).send('08031234567', 'hi');

    expect(body.route).toBe('non_dnd');
  });

  it('reports an error status and a body-level failure to the caller', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ status: 'failed', message: 'Insufficient balance' }), { status: 400 }),
    );
    await expect(new SendchampSms(champEnv).send('08031234567', 'hi')).rejects.toThrow(/400.*Insufficient balance/);

    // Sendchamp sometimes answers 200 while rejecting the message in the body.
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ status: 'failed', message: 'Route not enabled' }), { status: 200 }),
    );
    await expect(new SendchampSms(champEnv).send('08031234567', 'hi')).rejects.toThrow(/Route not enabled/);
  });
});

describe('OTP request when SMS cannot be delivered', () => {
  it.each(['termii', 'sendchamp'])('%s: tells the learner instead of pretending the code was sent', async (provider) => {
    vi.stubGlobal('fetch', async () => new Response('gateway down', { status: 500 }));
    const ctx = makeApp({ smsProvider: provider, smsApiKey: 'test-key' });
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
