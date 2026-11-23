import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

export const ROOT_DIR = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const CONTENT_DIR = path.join(ROOT_DIR, 'content');

dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export interface Env {
  appName: string;
  nodeEnv: string;
  port: number;
  webOrigin: string;
  databaseFile: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  encryptionKey: string;
  sttProvider: string;
  sttApiKey: string;
  sttModel: string;
  sttProviderByLang: Record<string, string>;
  ttsProvider: string;
  ttsApiKey: string;
  ttsModel: string;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
  smsProvider: string;
  smsApiKey: string;
  smsSenderId: string;
  whatsappProvider: string;
  whatsappApiKey: string;
  naceApiKey: string;
  retainAudio: boolean;
  audioRetentionHours: number;
  transcriptRetentionDays: number;
  allowUnreviewedTranslations: boolean;
  confThreshold: number;
  defaultLanguage: string;
  isTest: boolean;
}

export function loadEnv(overrides: Partial<Env> = {}): Env {
  const base: Env = {
    appName: process.env.APP_NAME || 'SABI',
    nodeEnv: process.env.NODE_ENV || 'development',
    port: num(process.env.PORT, 4100),
    webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
    databaseFile: process.env.DATABASE_FILE || '',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-me',
    sttProvider: process.env.STT_PROVIDER || 'mock',
    sttApiKey: process.env.STT_API_KEY || '',
    sttModel: process.env.STT_MODEL || 'whisper-1',
    sttProviderByLang: {
      yo: process.env.STT_PROVIDER_YO || '',
      ig: process.env.STT_PROVIDER_IG || '',
      pcm: process.env.STT_PROVIDER_PCM || '',
    },
    ttsProvider: process.env.TTS_PROVIDER || 'mock',
    ttsApiKey: process.env.TTS_API_KEY || '',
    ttsModel: process.env.TTS_MODEL || 'tts-1',
    llmProvider: process.env.LLM_PROVIDER || 'mock',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    smsProvider: process.env.SMS_PROVIDER || 'mock',
    smsApiKey: process.env.SMS_API_KEY || '',
    smsSenderId: process.env.SMS_SENDER_ID || 'SABI',
    whatsappProvider: process.env.WHATSAPP_PROVIDER || 'mock',
    whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
    naceApiKey: process.env.NACE_API_KEY || '',
    retainAudio: bool(process.env.RETAIN_AUDIO, false),
    audioRetentionHours: num(process.env.AUDIO_RETENTION_HOURS, 0),
    transcriptRetentionDays: num(process.env.TRANSCRIPT_RETENTION_DAYS, 30),
    allowUnreviewedTranslations: bool(process.env.ALLOW_UNREVIEWED_TRANSLATIONS, true),
    confThreshold: num(process.env.CONF_THRESHOLD, 0.6),
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
    isTest: process.env.NODE_ENV === 'test',
  };
  return { ...base, ...overrides };
}

export const env = loadEnv();
