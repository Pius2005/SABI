import type { Lang, Role, TranslationStatus } from '@sabi/shared';

export interface DbUser {
  id: string;
  role: Role;
  phoneEnc: string | null;
  phoneHash: string | null;
  phoneMasked: string | null;
  email: string | null;
  passwordHash: string | null;
  displayName: string;
  preferredLang: Lang;
  textSize: 'normal' | 'large' | 'xl';
  theme: 'light' | 'inverted';
  voiceSpeed: number;
  autoRead: boolean;
  reduceMotion: boolean;
  goalPathSlug: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface DbConsent {
  id: string;
  userId: string;
  type: string;
  granted: boolean;
  givenBy: string | null;
  createdAt: string;
}

export interface DbOtp {
  id: string;
  phoneHash: string;
  codeHash: string;
  attempts: number;
  expiresAt: string;
  lastSentAt: string;
  lockedUntil: string | null;
}

export interface DbRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface DbGroup {
  id: string;
  name: string;
  venue: string | null;
  schedule: string | null;
  facilitatorId: string;
  notes: string;
  createdAt: string;
}

export interface DbGroupMember {
  groupId: string;
  userId: string;
  addedAt: string;
}

export interface DbFamilyLink {
  id: string;
  learnerId: string;
  familyId: string;
  status: 'pending' | 'active';
  scopeProgress: boolean;
  scopeScamAlerts: boolean;
  scopeTranscripts: boolean;
  consentedAt: string;
  revokedAt: string | null;
}

export interface DbProgress {
  userId: string;
  lessonSlug: string;
  stepIndex: number;
  completedAt: string | null;
  stuckCount: number;
  updatedAt: string;
}

export interface DbSandboxAttempt {
  id: string;
  userId: string;
  taskId: string;
  success: boolean;
  hintsUsed: number;
  createdAt: string;
}

export interface DbHelpRequest {
  id: string;
  userId: string;
  type: 'call_back' | 'whatsapp' | 'facilitator';
  context: Record<string, unknown> | null;
  status: 'open' | 'contacted' | 'resolved';
  createdAt: string;
  contactedAt: string | null;
  resolvedAt: string | null;
}

export interface DbReminder {
  userId: string;
  channel: 'sms' | 'whatsapp' | 'in_app';
  weeklyDay: number;
  hour: number;
  quietStart: string;
  quietEnd: string;
  active: boolean;
  updatedAt: string;
}

export interface DbVoiceExchange {
  id: string;
  userId: string | null;
  lang: string;
  sttConfidence: number;
  transcript: string | null;
  replyPromptVersion: string;
  flaggedEvent: string | null;
  latencyMs: number;
  createdAt: string;
}

export interface DbScamCheck {
  id: string;
  userId: string | null;
  verdict: string;
  createdAt: string;
}

export interface DbTranslation {
  key: string;
  lang: Lang;
  text: string;
  status: TranslationStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  audioUrl: string | null;
  audioSource: 'tts' | 'human' | null;
}

export interface DbStep {
  id: string;
  textKey: string;
  text: string;
  alt: string;
  visual: string;
  spotlight: { shape: 'circle' | 'rect'; x: number; y: number; w: number; h: number } | null;
  practice: {
    app: string;
    target: string;
    instructionKey: string;
    instruction: string;
  } | null;
}

export interface DbLesson {
  slug: string;
  path: string;
  order: number;
  minutes: number;
  titleKey: string;
  title: string;
  steps: DbStep[];
  selfCheckKey: string;
  selfCheck: string;
  sandboxTask: string | null;
}

export interface DbPath {
  slug: string;
  titleKey: string;
  goalTag: string;
  order: number;
  icon: string;
  title: string;
  lessons: string[];
}

export interface DbScamExample {
  id: string;
  type: string;
  lang: Lang;
  text: string;
  isScam: boolean;
  redFlags: string[];
}

export interface DbGlossary {
  id: string;
  term: string;
  explanation: string;
  pcm?: string;
  status: TranslationStatus;
}

export interface DbAuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface DbProviderEval {
  id: string;
  kind: string;
  provider: string;
  lang: string;
  metric: string;
  value: number;
  createdAt: string;
}

export interface DbData {
  version: number;
  seededAt: string;
  users: DbUser[];
  consents: DbConsent[];
  otps: DbOtp[];
  refreshTokens: DbRefreshToken[];
  groups: DbGroup[];
  groupMembers: DbGroupMember[];
  familyLinks: DbFamilyLink[];
  progress: DbProgress[];
  sandboxAttempts: DbSandboxAttempt[];
  helpRequests: DbHelpRequest[];
  reminders: DbReminder[];
  voiceExchanges: DbVoiceExchange[];
  scamChecks: DbScamCheck[];
  translations: DbTranslation[];
  paths: DbPath[];
  lessons: DbLesson[];
  scamExamples: DbScamExample[];
  glossary: DbGlossary[];
  auditLogs: DbAuditLog[];
  providerEvals: DbProviderEval[];
}

export function emptyDb(): DbData {
  return {
    version: 1,
    seededAt: new Date().toISOString(),
    users: [],
    consents: [],
    otps: [],
    refreshTokens: [],
    groups: [],
    groupMembers: [],
    familyLinks: [],
    progress: [],
    sandboxAttempts: [],
    helpRequests: [],
    reminders: [],
    voiceExchanges: [],
    scamChecks: [],
    translations: [],
    paths: [],
    lessons: [],
    scamExamples: [],
    glossary: [],
    auditLogs: [],
    providerEvals: [],
  };
}
