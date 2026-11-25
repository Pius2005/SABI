import type { Env } from './env';

export interface LlmProvider {
  chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, opts: { temperature: number; maxTokens: number }): Promise<string>;
}

export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

export interface WhatsAppProvider {
  send(to: string, body: string): Promise<void>;
}

export class OpenAiLlm implements LlmProvider {
  constructor(private env: Env) {}
  async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, opts: { temperature: number; maxTokens: number }): Promise<string> {
    const res = await fetch(`${this.env.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.llmApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.env.llmModel,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
}

class MockSms implements SmsProvider {
  async send(to: string, body: string): Promise<void> {
    // Never log OTP values in production; the mock logs to the local console only.
    console.log(`[mock-sms] to ${to.replace(/\d(?=\d{4})/g, '*')}: ${body.replace(/\b\d{6}\b/g, '[code]')}`);
  }
}

/**
 * Every Nigerian gateway we use wants the international MSISDN
 * (2348031234567), while the app stores numbers in local form (08031234567).
 * Sending the local form is accepted by no gateway and silently fails to route,
 * so convert here rather than at every call site.
 */
export function toMsisdn(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

export class TermiiSms implements SmsProvider {
  constructor(private env: Env) {}
  async send(to: string, body: string): Promise<void> {
    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toMsisdn(to),
        from: this.env.smsSenderId,
        sms: body,
        type: 'plain',
        // OTPs belong on the transactional route; Termii warns that the
        // generic one drops numbers on DND and is blocked on MTN at night.
        channel: this.env.smsChannel === 'generic' ? 'generic' : 'dnd',
        api_key: this.env.smsApiKey,
      }),
    });
    if (!res.ok) {
      // The gateway explains itself (bad sender ID, no balance, unreachable
      // number). Keep it for the server log; the learner never sees it.
      const detail = await res.text().catch(() => '');
      throw new Error(`SMS failed: ${res.status} ${detail.slice(0, 300)}`.trim());
    }
  }
}

/**
 * Sendchamp is the free fallback: 50 SMS units on signup, no card. It takes the
 * same MSISDN form as Termii, but its routes are named differently: `dnd` is
 * the transactional route OTPs belong on and `non_dnd` is the promotional one.
 */
export class SendchampSms implements SmsProvider {
  constructor(private env: Env) {}
  async send(to: string, body: string): Promise<void> {
    const res = await fetch('https://api.sendchamp.com/api/v1/sms/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.env.smsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [toMsisdn(to)],
        message: body,
        sender_name: this.env.smsSenderId,
        route: this.env.smsChannel === 'generic' ? 'non_dnd' : 'dnd',
      }),
    });
    const detail = await res.text().catch(() => '');
    // Sendchamp reports some rejections (bad route, empty wallet) in the body
    // while still answering 200, so a 2xx alone does not mean the message was
    // accepted. Treat `status: "failed"` the same as an error status.
    let failedInBody = false;
    try {
      const parsed = JSON.parse(detail) as { status?: string };
      failedInBody = parsed.status === 'failed' || parsed.status === 'error';
    } catch {
      failedInBody = false;
    }
    if (!res.ok || failedInBody) {
      throw new Error(`SMS failed: ${res.status} ${detail.slice(0, 300)}`.trim());
    }
  }
}

class MockWhatsApp implements WhatsAppProvider {
  async send(to: string, body: string): Promise<void> {
    console.log(`[mock-whatsapp] to ${to.replace(/\d(?=\d{4})/g, '*')}: ${body.slice(0, 40)}…`);
  }
}

export function getLlmProvider(env: Env): LlmProvider | null {
  if (env.llmProvider === 'openai' && env.llmApiKey) return new OpenAiLlm(env);
  return null;
}

export function getSmsProvider(env: Env): SmsProvider {
  if (env.smsProvider === 'termii' && env.smsApiKey) return new TermiiSms(env);
  if (env.smsProvider === 'sendchamp' && env.smsApiKey) return new SendchampSms(env);
  return new MockSms();
}

export function getWhatsAppProvider(env: Env): WhatsAppProvider {
  void env;
  return new MockWhatsApp();
}
