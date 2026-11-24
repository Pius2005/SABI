import type { HelpStatus, Lang, Role, TextSize, Theme, TranslationStatus } from './config';

export interface PublicUser {
  id: string;
  role: Role;
  displayName: string;
  preferredLang: Lang;
  textSize: TextSize;
  theme: Theme;
  reduceMotion: boolean;
  phoneMasked: string | null;
  email: string | null;
  goalPathSlug: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface PathSummary {
  slug: string;
  titleKey: string;
  goalTag: string;
  order: number;
  icon: string;
  title: string;
  lessonCount: number;
}

export interface LessonStep {
  id: string;
  textKey: string;
  text: string;
  alt: string;
  visual: string;
  spotlight?: { shape: 'circle' | 'rect'; x: number; y: number; w: number; h: number } | null;
  practice?: SandboxTask | null;
  fallback: boolean;
  status: TranslationStatus | 'missing';
}

export type SandboxApp = 'dialer' | 'whatsapp' | 'sms' | 'bank' | 'camera' | 'settings' | 'phone';

export interface SandboxTask {
  app: SandboxApp;
  target: string;
  instructionKey: string;
  instruction: string;
}

export interface LessonDetail {
  slug: string;
  pathSlug: string;
  order: number;
  minutes: number;
  title: string;
  titleKey: string;
  steps: LessonStep[];
  selfCheck: string;
  selfCheckKey: string;
  sandboxTask: string | null;
  lang: Lang;
  fallback: boolean;
}

export interface PathDetail extends PathSummary {
  lessons: Array<{
    slug: string;
    title: string;
    order: number;
    minutes: number;
    completed: boolean;
    currentStep: number;
    locked: false;
  }>;
}

export interface ProgressRow {
  lessonId: string;
  lessonSlug: string;
  stepIndex: number;
  completedAt: string | null;
  stuckCount: number;
  updatedAt: string;
}

export interface ScamVerdict {
  verdict: 'scam' | 'unsure' | 'safe';
  confidence: number;
  headline: string;
  reasons: string[];
  nextSteps: string[];
  redFlags: string[];
  critical: boolean;
}

export interface AssistantReply {
  transcript: string;
  language: Lang | 'unknown';
  replyLang: Lang;
  confidence: number;
  reply: string;
  promptVersion: string;
  safety: { flagged: string | null; message: string | null };
}

export interface HelpRequest {
  id: string;
  userId: string;
  learnerName?: string;
  type: 'call_back' | 'whatsapp' | 'facilitator';
  context: Record<string, unknown> | null;
  status: HelpStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  venue: string | null;
  schedule: string | null;
  facilitatorId: string;
  memberCount: number;
}

export interface AdminAnalytics {
  learners: number;
  activeLearners: number;
  lessonsCompleted: number;
  stuckEvents: number;
  helpOpen: number;
  assistantTurns: number;
  scamChecks: number;
  translationCoverage: Record<Lang, { total: number; approved: number; needsReview: number; missing: number }>;
}
