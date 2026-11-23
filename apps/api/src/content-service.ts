import type { Lang, LessonDetail, LessonStep, PathDetail, PathSummary, SandboxTask, TranslationStatus } from '@sabi/shared';
import type { Env } from './env';
import type { Store } from './store';

export interface Resolved {
  text: string;
  status: TranslationStatus | 'missing';
  fallback: boolean;
}

function servable(status: TranslationStatus | undefined, env: Env): boolean {
  if (!status) return false;
  if (status === 'approved') return true;
  if (env.allowUnreviewedTranslations && (status === 'needs_review' || status === 'machine')) return true;
  return false;
}

export function resolveText(store: Store, key: string, lang: Lang, env: Env): Resolved {
  const row = store.translation(key, lang);
  if (row && servable(row.status, env)) {
    return { text: row.text, status: row.status, fallback: row.status !== 'approved' };
  }
  const en = store.translation(key, 'en');
  if (en) {
    return {
      text: en.text,
      status: lang === 'en' ? en.status : 'missing',
      fallback: lang !== 'en',
    };
  }
  return { text: key, status: 'missing', fallback: true };
}

export function pathSummary(store: Store, pathSlug: string, lang: Lang, env: Env): PathSummary | null {
  const p = store.path(pathSlug);
  if (!p) return null;
  const title = resolveText(store, p.titleKey, lang, env);
  return {
    slug: p.slug,
    titleKey: p.titleKey,
    goalTag: p.goalTag,
    order: p.order,
    icon: p.icon,
    title: title.text,
    lessonCount: p.lessons.length,
  };
}

export function listPaths(store: Store, lang: Lang, env: Env): PathSummary[] {
  return store.data.paths
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((p) => pathSummary(store, p.slug, lang, env))
    .filter((p): p is PathSummary => Boolean(p));
}

export function pathDetail(store: Store, pathSlug: string, userId: string, lang: Lang, env: Env): PathDetail | null {
  const summary = pathSummary(store, pathSlug, lang, env);
  if (!summary) return null;
  const p = store.path(pathSlug);
  if (!p) return null;
  const lessons = p.lessons
    .map((slug) => store.lesson(slug))
    .filter((l): l is NonNullable<ReturnType<Store['lesson']>> => Boolean(l))
    .sort((a, b) => a.order - b.order)
    .map((lesson) => {
      const progress = store.progress(userId, lesson.slug);
      return {
        slug: lesson.slug,
        title: resolveText(store, lesson.titleKey, lang, env).text,
        order: lesson.order,
        minutes: lesson.minutes,
        completed: Boolean(progress?.completedAt),
        currentStep: progress?.stepIndex ?? 0,
        locked: false as const,
      };
    });
  return { ...summary, lessons };
}

export function lessonDetail(store: Store, slug: string, lang: Lang, env: Env): LessonDetail | null {
  const lesson = store.lesson(slug);
  if (!lesson) return null;
  const title = resolveText(store, lesson.titleKey, lang, env);
  const steps: LessonStep[] = lesson.steps.map((step) => {
    const text = resolveText(store, step.textKey, lang, env);
    const alt = resolveText(store, `${step.textKey}.alt`, lang, env);
    const instruction = step.practice
      ? resolveText(store, step.practice.instructionKey, lang, env)
      : null;
    return {
      id: step.id,
      textKey: step.textKey,
      text: text.text,
      alt: alt.text === `${step.textKey}.alt` ? step.alt : alt.text,
      visual: step.visual,
      spotlight: step.spotlight,
      practice: step.practice
        ? {
            app: step.practice.app as SandboxTask['app'],
            target: step.practice.target,
            instructionKey: step.practice.instructionKey,
            instruction: instruction?.text ?? step.practice.instruction,
          }
        : null,
      fallback: text.fallback,
      status: text.status,
    };
  });
  const check = resolveText(store, lesson.selfCheckKey, lang, env);
  return {
    slug: lesson.slug,
    pathSlug: lesson.path,
    order: lesson.order,
    minutes: lesson.minutes,
    title: title.text,
    titleKey: lesson.titleKey,
    steps,
    selfCheck: check.text,
    selfCheckKey: lesson.selfCheckKey,
    sandboxTask: lesson.sandboxTask,
    lang,
    fallback: title.fallback || steps.some((s) => s.fallback),
  };
}

export function uiStrings(store: Store, lang: Lang, env: Env): { strings: Record<string, string>; statuses: Record<string, string>; notice: boolean } {
  const en = store.data.translations.filter((t) => t.lang === 'en');
  const strings: Record<string, string> = {};
  const statuses: Record<string, string> = {};
  let notice = false;
  for (const row of en) {
    const resolved = resolveText(store, row.key, lang, env);
    strings[row.key] = resolved.text;
    statuses[row.key] = resolved.status;
    if (lang !== 'en' && resolved.fallback) notice = true;
  }
  return { strings, statuses, notice };
}

export function translationCoverage(store: Store, env: Env): Record<Lang, { total: number; approved: number; needsReview: number; missing: number }> {
  const keys = new Set(store.data.translations.map((t) => t.key));
  const langs: Lang[] = ['en', 'yo', 'ig', 'pcm'];
  const out = {} as Record<Lang, { total: number; approved: number; needsReview: number; missing: number }>;
  for (const lang of langs) {
    const rows = store.data.translations.filter((t) => t.lang === lang);
    const approved = rows.filter((t) => t.status === 'approved').length;
    const needsReview = rows.filter((t) => t.status === 'needs_review' || t.status === 'machine').length;
    out[lang] = {
      total: keys.size,
      approved,
      needsReview,
      missing: Math.max(0, keys.size - rows.length),
    };
  }
  void env;
  return out;
}
