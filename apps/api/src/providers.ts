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

class TermiiSms implements SmsProvider {
  constructor(private env: Env) {}
  async send(to: string, body: string): Promise<void> {
    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        from: this.env.smsSenderId,
        sms: body,
        type: 'plain',
        channel: 'generic',
        api_key: this.env.smsApiKey,
      }),
    });
    if (!res.ok) throw new Error(`SMS failed: ${res.status}`);
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
  return new MockSms();
}

export function getWhatsAppProvider(env: Env): WhatsAppProvider {
  void env;
  return new MockWhatsApp();
}
