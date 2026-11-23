import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Lang } from '@sabi/shared';
import type { Env } from './env';
import { cacheKey } from './crypto';
import { getTtsProvider } from './providers';

interface CachedAudio {
  buffer: Buffer;
  mimeType: string;
  ext: string;
}

const memory = new Map<string, CachedAudio>();
const CACHE_DIR = path.resolve(fileURLToPath(new URL('../tts-cache', import.meta.url)));

function extFor(mime: string): string {
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

export async function synthesizeCached(
  text: string,
  lang: Lang,
  speed: number,
  env: Env,
): Promise<{ hash: string; buffer: Buffer; mimeType: string; ext: string }> {
  const hash = cacheKey([text.trim(), lang, speed.toFixed(2), env.ttsProvider]);
  const hit = memory.get(hash);
  if (hit) return { hash, ...hit };

  const provider = getTtsProvider(env);
  let result: { audio: Buffer; mimeType: string };
  try {
    result = await provider.synthesize(text, { language: lang, speed });
  } catch {
    result = await getTtsProvider({ ...env, ttsProvider: 'mock' }).synthesize(text, { language: lang, speed });
  }
  const cached: CachedAudio = { buffer: result.audio, mimeType: result.mimeType, ext: extFor(result.mimeType) };
  memory.set(hash, cached);
  if (memory.size > 500) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
  if (env.nodeEnv !== 'test') {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(path.join(CACHE_DIR, `${hash}.${cached.ext}`), cached.buffer);
    } catch {
      /* cache is best effort */
    }
  }
  return { hash, ...cached };
}

export function readCachedAudio(hash: string): CachedAudio | null {
  const hit = memory.get(hash);
  if (hit) return hit;
  try {
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    const dir = fs.readdirSync(CACHE_DIR);
    const name = dir.find((f) => f.startsWith(hash));
    if (!name) return null;
    const buffer = fs.readFileSync(path.join(CACHE_DIR, name));
    const ext = name.split('.').pop() ?? 'wav';
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'ogg' ? 'audio/ogg' : 'audio/wav';
    return { buffer, mimeType, ext };
  } catch {
    return null;
  }
}
