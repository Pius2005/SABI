/**
 * APP_NAME is the single source of truth for the product name.
 * Override with APP_NAME in the API environment or VITE_APP_NAME for the web app.
 */
function readEnv(name: string): string | undefined {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name];
    }
  } catch {
    /* browser without process shim */
  }
  return undefined;
}

export const APP_NAME: string = readEnv('APP_NAME') || readEnv('VITE_APP_NAME') || 'SABI';

export const APP_TAGLINE = 'Learn phones and the internet, safely, in your own language.';

export const LANGUAGES = ['en', 'yo', 'ig', 'pcm'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  yo: 'Yorùbá',
  ig: 'Igbo',
  pcm: 'Nigerian Pidgin',
};

export const LANGUAGE_GREETINGS: Record<Lang, string> = {
  en: 'Welcome. I am SABI. I will help you learn, step by step.',
  yo: 'Ẹ káàbọ̀. Èmi ni SABI. Màá ràn yín lọ́wọ́ láti kọ́ ẹ̀kọ́ kọ̀ọ̀kan.',
  ig: 'Ndewo. Abụ m SABI. M ga-enyere gị aka ịmụta nke ọma.',
  pcm: 'Welcome. Na SABI be my name. I go help you learn small small.',
};

/** BCP-47 tags used by the browser speech engine and provider adapters. */
export const SPEECH_TAGS: Record<Lang, string> = {
  en: 'en-NG',
  yo: 'yo-NG',
  ig: 'ig-NG',
  pcm: 'en-NG',
};

export const ROLES = ['LEARNER', 'FACILITATOR', 'FAMILY', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const TRANSLATION_STATUSES = ['draft', 'machine', 'needs_review', 'approved'] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export const HELP_STATUSES = ['open', 'contacted', 'resolved'] as const;
export type HelpStatus = (typeof HELP_STATUSES)[number];

export const TEXT_SIZES = ['normal', 'large', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const THEMES = ['light', 'inverted'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_SETTINGS = {
  preferredLang: 'en' as Lang,
  textSize: 'large' as TextSize,
  theme: 'light' as Theme,
  voiceSpeed: 0.9,
  autoRead: true,
  reduceMotion: false,
};

export const GOALS = [
  { id: 'family', titleKey: 'goal.family', pathSlug: 'calls-and-family', icon: 'call' },
  { id: 'whatsapp', titleKey: 'goal.whatsapp', pathSlug: 'whatsapp', icon: 'chat' },
  { id: 'banking', titleKey: 'goal.banking', pathSlug: 'money-safely', icon: 'bank' },
  { id: 'scams', titleKey: 'goal.scams', pathSlug: 'stay-safe', icon: 'shield' },
  { id: 'basics', titleKey: 'goal.basics', pathSlug: 'phone-basics', icon: 'phone' },
  { id: 'services', titleKey: 'goal.services', pathSlug: 'everyday-services', icon: 'globe' },
] as const;
