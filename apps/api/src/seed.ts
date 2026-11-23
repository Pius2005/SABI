import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Lang, Role, TranslationStatus } from '@sabi/shared';
import type { DbData, DbLesson, DbPath, DbScamExample, DbStep, DbTranslation, DbUser } from './db-types';
import { emptyDb } from './db-types';
import type { Env } from './env';
import { CONTENT_DIR } from './env';
import { encryptPhone, hashPhone, maskPhone, normalizePhone } from './crypto';

interface RawPath {
  slug: string;
  titleKey: string;
  goalTag: string;
  order: number;
  icon: string;
  title: string;
  lessons: string[];
}

interface RawStep {
  id: string;
  textKey: string;
  text: string;
  texts?: Record<string, string>;
  alt: string;
  visual: string;
  spotlight?: DbStep['spotlight'];
  practice?: DbStep['practice'];
}

interface RawLesson {
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

function readJson<T>(file: string): T {
  const full = path.join(CONTENT_DIR, file);
  return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function seedDatabase(env: Env): DbData {
  const db = emptyDb();
  const now = new Date().toISOString();

  const rawPaths = readJson<RawPath[]>('paths.json');
  const rawLessons = readJson<RawLesson[]>('lessons.json');
  const strings: Record<string, Record<string, string>> = {
    en: readJson('strings/en.json'),
    yo: readJson('strings/yo.json'),
    ig: readJson('strings/ig.json'),
    pcm: readJson('strings/pcm.json'),
  };
  const scamExamples = readJson<DbScamExample[]>('scam-examples.json');
  const glossary = readJson<DbData['glossary']>('glossary.json');

  db.paths = rawPaths.map((p) => ({
    slug: p.slug,
    titleKey: p.titleKey,
    goalTag: p.goalTag,
    order: p.order,
    icon: p.icon,
    title: p.title,
    lessons: p.lessons,
  }));

  db.lessons = rawLessons.map(
    (l): DbLesson => ({
      slug: l.slug,
      path: l.path,
      order: l.order,
      minutes: l.minutes,
      titleKey: l.titleKey,
      title: l.title,
      selfCheckKey: l.selfCheckKey,
      selfCheck: l.selfCheck,
      sandboxTask: l.sandboxTask,
      steps: l.steps.map((s) => ({
        id: s.id,
        textKey: s.textKey,
        text: s.text,
        alt: s.alt,
        visual: s.visual,
        spotlight: s.spotlight ?? null,
        practice: s.practice ?? null,
      })),
    }),
  );

  const translations: DbTranslation[] = [];
  const seen = new Set<string>();
  const addTranslation = (key: string, lang: Lang, text: string, status: TranslationStatus, source: 'content' | 'ui' = 'content') => {
    if (!key || !text) return;
    const id = `${key}|${lang}`;
    if (seen.has(id)) return;
    seen.add(id);
    translations.push({
      key,
      lang,
      text,
      status,
      reviewerId: null,
      reviewedAt: status === 'approved' ? now : null,
      audioUrl: null,
      audioSource: null,
    });
    void source;
  };

  for (const lang of ['en', 'yo', 'ig', 'pcm'] as Lang[]) {
    const dict = strings[lang] ?? {};
    for (const [key, value] of Object.entries(dict)) {
      addTranslation(key, lang, value, lang === 'en' ? 'approved' : 'needs_review', 'ui');
    }
  }

  for (const lesson of rawLessons) {
    addTranslation(lesson.titleKey, 'en', lesson.title, 'approved');
    for (const [lang, text] of Object.entries(lesson.titleTexts ?? {})) {
      addTranslation(lesson.titleKey, lang as Lang, text, 'needs_review');
    }
    addTranslation(lesson.selfCheckKey, 'en', lesson.selfCheck, 'approved');
    for (const [lang, text] of Object.entries(lesson.checkTexts ?? {})) {
      addTranslation(lesson.selfCheckKey, lang as Lang, text, 'needs_review');
    }
    for (const step of lesson.steps) {
      addTranslation(step.textKey, 'en', step.text, 'approved');
      addTranslation(`${step.textKey}.alt`, 'en', step.alt, 'approved');
      for (const [lang, text] of Object.entries(step.texts ?? {})) {
        addTranslation(step.textKey, lang as Lang, text, 'needs_review');
      }
      if (step.practice) {
        addTranslation(step.practice.instructionKey, 'en', step.practice.instruction, 'approved');
      }
    }
  }
  db.translations = translations;
  db.scamExamples = scamExamples.map((s) => ({ ...s, id: s.id || crypto.randomUUID() }));
  db.glossary = glossary.map((g) => ({ ...g, id: g.id || crypto.randomUUID() }));

  const addUser = (input: {
    role: Role;
    name: string;
    phone?: string;
    email?: string;
    password?: string;
    lang?: Lang;
    goal?: string | null;
    textSize?: DbUser['textSize'];
  }): DbUser => {
    const user: DbUser = {
      id: crypto.randomUUID(),
      role: input.role,
      phoneEnc: input.phone ? encryptPhone(input.phone, env) : null,
      phoneHash: input.phone ? hashPhone(input.phone, env) : null,
      phoneMasked: input.phone ? maskPhone(input.phone) : null,
      email: input.email ?? null,
      passwordHash: input.password ? bcrypt.hashSync(input.password, 8) : null,
      displayName: input.name,
      preferredLang: input.lang ?? 'en',
      textSize: input.textSize ?? 'large',
      theme: 'light',
      voiceSpeed: 0.9,
      autoRead: true,
      reduceMotion: false,
      goalPathSlug: input.goal ?? null,
      createdAt: now,
      deletedAt: null,
    };
    db.users.push(user);
    return user;
  };

  const admin = addUser({
    role: 'ADMIN',
    name: `${env.appName} Admin`,
    email: 'admin@sabi.app',
    password: 'Admin123!',
  });
  const facilitator = addUser({
    role: 'FACILITATOR',
    name: 'Mama Ngozi',
    email: 'facilitator@sabi.app',
    password: 'Teach123!',
    lang: 'ig',
  });
  const family = addUser({
    role: 'FAMILY',
    name: 'Ada Obi',
    email: 'family@sabi.app',
    password: 'Family123!',
    phone: '08039999999',
    lang: 'en',
  });

  const learners = [
    addUser({ role: 'LEARNER', name: 'Baba Tunde', phone: '08030000001', lang: 'yo', goal: 'calls-and-family' }),
    addUser({ role: 'LEARNER', name: 'Mama Adaeze', phone: '08030000002', lang: 'ig', goal: 'whatsapp' }),
    addUser({ role: 'LEARNER', name: 'Papa Chinedu', phone: '08030000003', lang: 'pcm', goal: 'money-safely' }),
    addUser({ role: 'LEARNER', name: 'Iya Bose', phone: '08030000004', lang: 'yo', goal: 'stay-safe' }),
    addUser({ role: 'LEARNER', name: 'Alhaji Musa', phone: '08030000005', lang: 'en', goal: 'phone-basics' }),
    addUser({ role: 'LEARNER', name: 'Mama Grace', phone: '08030000006', lang: 'en', goal: 'everyday-services' }),
  ];

  const consentTypes = ['terms', 'privacy', 'ai_notice', 'store_transcripts', 'store_audio', 'analytics'];
  for (const learner of learners) {
    for (const type of consentTypes) {
      db.consents.push({
        id: crypto.randomUUID(),
        userId: learner.id,
        type,
        granted: ['terms', 'privacy', 'ai_notice'].includes(type),
        givenBy: null,
        createdAt: isoDaysAgo(20),
      });
    }
  }
  for (const staff of [admin, facilitator, family]) {
    for (const type of ['terms', 'privacy', 'ai_notice']) {
      db.consents.push({
        id: crypto.randomUUID(),
        userId: staff.id,
        type,
        granted: true,
        givenBy: null,
        createdAt: isoDaysAgo(25),
      });
    }
  }

  const group1 = {
    id: crypto.randomUUID(),
    name: 'Ijebu Community Centre',
    venue: 'Ijebu-Ode',
    schedule: 'Tuesdays, 10:00',
    facilitatorId: facilitator.id,
    notes: 'Group is comfortable with voice notes. Slow down on banking lessons.',
    createdAt: isoDaysAgo(30),
  };
  const group2 = {
    id: crypto.randomUUID(),
    name: 'Lagos Island Seniors',
    venue: 'Lagos Island',
    schedule: 'Thursdays, 15:00',
    facilitatorId: facilitator.id,
    notes: '',
    createdAt: isoDaysAgo(18),
  };
  db.groups.push(group1, group2);
  for (const learner of learners.slice(0, 3)) {
    db.groupMembers.push({ groupId: group1.id, userId: learner.id, addedAt: isoDaysAgo(28) });
  }
  for (const learner of learners.slice(3)) {
    db.groupMembers.push({ groupId: group2.id, userId: learner.id, addedAt: isoDaysAgo(16) });
  }

  const link = {
    id: crypto.randomUUID(),
    learnerId: learners[0].id,
    familyId: family.id,
    status: 'active' as const,
    scopeProgress: true,
    scopeScamAlerts: true,
    scopeTranscripts: false,
    consentedAt: isoDaysAgo(10),
    revokedAt: null,
  };
  db.familyLinks.push(link);
  db.consents.push({
    id: crypto.randomUUID(),
    userId: learners[0].id,
    type: 'family_link',
    granted: true,
    givenBy: null,
    createdAt: isoDaysAgo(10),
  });
  db.familyLinks.push({
    id: crypto.randomUUID(),
    learnerId: learners[1].id,
    familyId: family.id,
    status: 'pending',
    scopeProgress: true,
    scopeScamAlerts: false,
    scopeTranscripts: false,
    consentedAt: isoDaysAgo(2),
    revokedAt: null,
  });

  const progressSeed: Array<[number, string, number, number | null]> = [
    [0, 'hold-and-switch-on', 3, 14],
    [0, 'charge-your-phone', 2, 13],
    [0, 'touch-the-screen', 1, null],
    [0, 'make-a-phone-call', 4, 6],
    [0, 'answer-and-end-a-call', 0, null],
    [1, 'open-whatsapp', 2, 9],
    [1, 'open-a-chat', 0, null],
    [2, 'what-is-a-banking-app', 3, 8],
    [2, 'check-your-balance', 1, null],
    [3, 'a-message-asks-for-your-pin', 4, 5],
    [3, 'you-won-a-prize', 0, null],
    [5, 'find-information', 2, 3],
  ];
  for (const [index, slug, stepIndex, daysAgo] of progressSeed) {
    const learner = learners[index];
    if (!learner) continue;
    const lesson = db.lessons.find((l) => l.slug === slug);
    if (!lesson) continue;
    db.progress.push({
      userId: learner.id,
      lessonSlug: slug,
      stepIndex,
      completedAt: daysAgo !== null ? isoDaysAgo(daysAgo) : null,
      stuckCount: slug === 'check-your-balance' ? 2 : 0,
      updatedAt: isoDaysAgo(daysAgo ?? 1),
    });
  }

  db.helpRequests.push({
    id: crypto.randomUUID(),
    userId: learners[2].id,
    type: 'call_back',
    context: { lessonSlug: 'check-your-balance', note: 'Stuck on the PIN screen.' },
    status: 'open',
    createdAt: isoDaysAgo(1),
    contactedAt: null,
    resolvedAt: null,
  });

  db.reminders.push({
    userId: learners[0].id,
    channel: 'sms',
    weeklyDay: 2,
    hour: 10,
    quietStart: '20:00',
    quietEnd: '08:00',
    active: true,
    updatedAt: now,
  });

  db.voiceExchanges.push(
    {
      id: crypto.randomUUID(),
      userId: learners[0].id,
      lang: 'yo',
      sttConfidence: 0.86,
      transcript: null,
      replyPromptVersion: 'assistant.v1',
      flaggedEvent: null,
      latencyMs: 2400,
      createdAt: isoDaysAgo(4),
    },
    {
      id: crypto.randomUUID(),
      userId: learners[2].id,
      lang: 'pcm',
      sttConfidence: 0.52,
      transcript: null,
      replyPromptVersion: 'assistant.v1',
      flaggedEvent: 'low_confidence',
      latencyMs: 3100,
      createdAt: isoDaysAgo(2),
    },
  );
  db.scamChecks.push(
    { id: crypto.randomUUID(), userId: learners[3].id, verdict: 'scam', createdAt: isoDaysAgo(3) },
    { id: crypto.randomUUID(), userId: learners[0].id, verdict: 'safe', createdAt: isoDaysAgo(1) },
  );

  db.auditLogs.push(
    {
      id: crypto.randomUUID(),
      actorId: admin.id,
      action: 'seed',
      entity: 'database',
      entityId: null,
      meta: { paths: db.paths.length, lessons: db.lessons.length, translations: db.translations.length },
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      actorId: admin.id,
      action: 'approve_translation',
      entity: 'translation',
      entityId: 'lesson.make_a_phone_call.title|en',
      meta: { lang: 'en' },
      createdAt: isoDaysAgo(6),
    },
  );

  return db;
}

export function phoneForSeedUser(phone: string, env: Env): { phoneHash: string; phoneEnc: string; phoneMasked: string } {
  return {
    phoneHash: hashPhone(normalizePhone(phone), env),
    phoneEnc: encryptPhone(phone, env),
    phoneMasked: maskPhone(phone),
  };
}

export function contentPathsForSeed(): DbPath[] {
  return readJson<RawPath[]>('paths.json').map((p) => ({
    slug: p.slug,
    titleKey: p.titleKey,
    goalTag: p.goalTag,
    order: p.order,
    icon: p.icon,
    title: p.title,
    lessons: p.lessons,
  }));
}
