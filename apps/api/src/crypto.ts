import crypto from 'node:crypto';
import type { Env } from './env';

export function normalizePhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith('0') && digits.length === 11) return digits;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

export function isValidNgPhone(raw: string): boolean {
  const phone = normalizePhone(raw);
  return /^0[789]\d{9}$/.test(phone);
}

export function maskPhone(raw: string): string {
  const phone = normalizePhone(raw);
  if (phone.length < 7) return '***';
  return `${phone.slice(0, 4)} *** ${phone.slice(-4)}`;
}

function phoneKey(env: Env): Buffer {
  return crypto.scryptSync(env.encryptionKey, 'sabi-phone-key', 32);
}

export function hashPhone(phone: string, env: Env): string {
  return crypto.createHmac('sha256', phoneKey(env)).update(normalizePhone(phone)).digest('hex');
}

export function encryptPhone(phone: string, env: Env): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', phoneKey(env), iv);
  const enc = Buffer.concat([cipher.update(normalizePhone(phone), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptPhone(payload: string, env: Env): string {
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', phoneKey(env), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(`sabi-otp:${code}`).digest('hex');
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function otpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function cacheKey(parts: Array<string | number>): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}
