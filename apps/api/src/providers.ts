import type { Lang } from '@sabi/shared';
import type { Env } from './env';

export interface SttResult {
  text: string;
  language: Lang | 'unknown';
  confidence: number;
}

export interface SttProvider {
  transcribe(audio: Buffer, opts: { languageHint?: Lang | 'auto'; mimeType: string }): Promise<SttResult>;
}

export interface TtsProvider {
  synthesize(text: string, opts: { language: Lang; speed: number; voice?: string }): Promise<{ audio: Buffer; mimeType: string }>;
}

export interface LlmProvider {
  chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, opts: { temperature: number; maxTokens: number }): Promise<string>;
}

export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

export interface WhatsAppProvider {
  send(to: string, body: string): Promise<void>;
}

const LANGUAGE_CODE: Record<string, string> = { en: 'en', yo: 'yo', ig: 'ig', pcm: 'en' };

class MockStt implements SttProvider {
  async transcribe(): Promise<SttResult> {
    return { text: '', language: 'unknown', confidence: 0 };
  }
}

class OpenAiStt implements SttProvider {
  constructor(private env: Env) {}
  async transcribe(audio: Buffer, opts: { languageHint?: Lang | 'auto'; mimeType: string }): Promise<SttResult> {
    const form = new FormData();
    const ext = opts.mimeType.includes('wav') ? 'wav' : opts.mimeType.includes('mp4') ? 'mp4' : 'webm';
    form.append('file', new Blob([new Uint8Array(audio)], { type: opts.mimeType }), `clip.${ext}`);
    form.append('model', this.env.sttModel);
    if (opts.languageHint && opts.languageHint !== 'auto') {
      form.append('language', LANGUAGE_CODE[opts.languageHint] ?? 'en');
    }
    const res = await fetch(`${this.env.llmBaseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.sttApiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`STT failed: ${res.status}`);
    const data = (await res.json()) as { text?: string };
    return {
      text: data.text ?? '',
      language: opts.languageHint && opts.languageHint !== 'auto' ? opts.languageHint : 'unknown',
      confidence: 0.9,
    };
  }
}

class MockTts implements TtsProvider {
  async synthesize(): Promise<{ audio: Buffer; mimeType: string }> {
    return { audio: silentWav(0.4), mimeType: 'audio/wav' };
  }
}

class OpenAiTts implements TtsProvider {
  constructor(private env: Env) {}
  async synthesize(text: string, opts: { language: Lang; speed: number; voice?: string }): Promise<{ audio: Buffer; mimeType: string }> {
    const res = await fetch(`${this.env.llmBaseUrl}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.ttsApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.env.ttsModel,
        voice: opts.voice ?? 'alloy',
        input: text,
        speed: opts.speed,
        response_format: 'mp3',
      }),
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
    const audio = Buffer.from(await res.arrayBuffer());
    return { audio, mimeType: 'audio/mpeg' };
  }
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

export function getSttProvider(env: Env, lang?: Lang): SttProvider {
  const perLang = lang ? env.sttProviderByLang[lang] : '';
  const name = perLang || env.sttProvider;
  if (name === 'openai' && env.sttApiKey) return new OpenAiStt(env);
  return new MockStt();
}

export function getTtsProvider(env: Env): TtsProvider {
  if (env.ttsProvider === 'openai' && env.ttsApiKey) return new OpenAiTts(env);
  return new MockTts();
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

export function silentWav(seconds: number): Buffer {
  const sampleRate = 8000;
  const samples = Math.max(1, Math.floor(sampleRate * seconds));
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}
