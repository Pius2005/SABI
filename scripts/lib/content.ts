import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const CONTENT_DIR = path.join(ROOT_DIR, 'content');

export interface RawPath {
  slug: string;
  titleKey: string;
  goalTag: string;
  order: number;
  icon: string;
  title: string;
  lessons: string[];
}

export interface RawStep {
  id: string;
  textKey: string;
  text: string;
  texts?: Record<string, string>;
  alt: string;
  visual: string;
  spotlight?: { shape: 'circle' | 'rect'; x: number; y: number; w: number; h: number } | null;
  practice?: {
    app: string;
    target: string;
    instructionKey: string;
    instruction: string;
  } | null;
}

export interface RawLesson {
  slug: string;
  path: string;
  order: number;
  minutes: number;
  titleKey: string;
  title: string;
  titleTexts?: Record<string, string>;
  steps: RawStep[];
  selfCheckKey: string;
  selfCheck: string;
  checkTexts?: Record<string, string>;
  sandboxTask: string | null;
}

export interface ScamExample {
  id: string;
  type: string;
  lang: string;
  text: string;
  isScam: boolean;
  redFlags: string[];
}

export interface GlossaryEntry {
  id: string;
  term: string;
  explanation: string;
  pcm?: string;
  status: string;
}

export interface ScamEvalRow {
  id: string;
  text: string;
  expected: 'scam' | 'unsure' | 'safe';
}

export type AssistantExpectation = 'sensitive_block' | 'crisis' | 'ai' | 'no_advice' | 'normal';

export interface AssistantSafetyRow {
  id: string;
  prompt: string;
  expect: AssistantExpectation;
}

export type Lang = 'en' | 'yo' | 'ig' | 'pcm';

export const LANGS: Lang[] = ['en', 'yo', 'ig', 'pcm'];

export const PRACTICE_APPS = ['dialer', 'whatsapp', 'sms', 'bank', 'camera', 'settings', 'phone'];

export function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, relative), 'utf8')) as T;
}

export interface ContentBundle {
  paths: RawPath[];
  lessons: RawLesson[];
  strings: Record<Lang, Record<string, string>>;
  scamExamples: ScamExample[];
  glossary: GlossaryEntry[];
  scamEval: ScamEvalRow[];
  assistantSafety: AssistantSafetyRow[];
}

export function loadContent(): ContentBundle {
  return {
    paths: readJson<RawPath[]>('paths.json'),
    lessons: readJson<RawLesson[]>('lessons.json'),
    strings: {
      en: readJson('strings/en.json'),
      yo: readJson('strings/yo.json'),
      ig: readJson('strings/ig.json'),
      pcm: readJson('strings/pcm.json'),
    },
    scamExamples: readJson<ScamExample[]>('scam-examples.json'),
    glossary: readJson<GlossaryEntry[]>('glossary.json'),
    scamEval: readJson<ScamEvalRow[]>('scam-eval.json'),
    assistantSafety: readJson<AssistantSafetyRow[]>('assistant-safety-tests.json'),
  };
}

export function pad(value: string | number, width: number): string {
  return String(value).padEnd(width, ' ');
}
