import type {
  Lang,
  LessonDetail,
  PathDetail,
  ProgressRow,
  PublicUser,
  TextSize,
  Theme,
} from '@sabi/shared';

/* ---------------------------------------------------------------------------
   Small, defensive localStorage helpers. Storage can be unavailable in private
   browsing, so every write reports success instead of throwing.
   --------------------------------------------------------------------------- */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ session */

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const SESSION_KEY = 'sabi.session.v1';

export function loadSession(): StoredSession | null {
  const value = readJson<StoredSession | null>(SESSION_KEY, null);
  if (!value || typeof value.accessToken !== 'string' || typeof value.refreshToken !== 'string' || !value.user) {
    return null;
  }
  return value;
}

export function saveSession(session: StoredSession): void {
  writeJson(SESSION_KEY, session);
}

export function clearSession(): void {
  removeKey(SESSION_KEY);
}

/* ----------------------------------------------------------------- settings */

export interface LocalSettings {
  preferredLang: Lang;
  textSize: TextSize;
  theme: Theme;
  voiceSpeed: number;
  autoRead: boolean;
  reduceMotion: boolean;
}

const SETTINGS_KEY = 'sabi.settings.v1';
const PENDING_SETTINGS_KEY = 'sabi.pending-settings.v1';

export function loadLocalSettings(): Partial<LocalSettings> {
  return readJson<Partial<LocalSettings>>(SETTINGS_KEY, {});
}

export function saveLocalSettings(settings: LocalSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function queueSettingsPatch(patch: Partial<LocalSettings>): void {
  const pending = readJson<Partial<LocalSettings>>(PENDING_SETTINGS_KEY, {});
  writeJson(PENDING_SETTINGS_KEY, { ...pending, ...patch });
}

export function takePendingSettings(): Partial<LocalSettings> | null {
  const pending = readJson<Partial<LocalSettings> | null>(PENDING_SETTINGS_KEY, null);
  removeKey(PENDING_SETTINGS_KEY);
  return pending && Object.keys(pending).length ? pending : null;
}

/* ---------------------------------------------------------- offline bundles */

export interface OfflineBundle {
  lesson: LessonDetail;
  path: PathDetail | null;
  strings: Record<string, string>;
  downloadedAt: string;
}

type BundleMap = Record<string, Record<string, OfflineBundle>>;

const BUNDLES_KEY = 'sabi.bundles.v1';

export function loadBundles(): BundleMap {
  return readJson<BundleMap>(BUNDLES_KEY, {});
}

function saveBundles(map: BundleMap): boolean {
  return writeJson(BUNDLES_KEY, map);
}

export function getBundle(lang: Lang, slug: string): OfflineBundle | null {
  return loadBundles()[lang]?.[slug] ?? null;
}

export function putBundle(lang: Lang, slug: string, bundle: OfflineBundle): boolean {
  const map = loadBundles();
  map[lang] = map[lang] ?? {};
  map[lang][slug] = bundle;
  return saveBundles(map);
}

export function removeBundle(lang: Lang, slug: string): void {
  const map = loadBundles();
  if (map[lang]) {
    delete map[lang][slug];
    if (Object.keys(map[lang]).length === 0) delete map[lang];
  }
  saveBundles(map);
}

export function clearBundles(lang?: Lang): void {
  if (!lang) {
    removeKey(BUNDLES_KEY);
    return;
  }
  const map = loadBundles();
  delete map[lang];
  saveBundles(map);
}

export interface BundleEntry {
  lang: Lang;
  slug: string;
  title: string;
  pathSlug: string;
  downloadedAt: string;
}

export function bundleList(): BundleEntry[] {
  const map = loadBundles();
  const out: BundleEntry[] = [];
  for (const [lang, lessons] of Object.entries(map)) {
    for (const [slug, bundle] of Object.entries(lessons)) {
      out.push({
        lang: lang as Lang,
        slug,
        title: bundle.lesson.title,
        pathSlug: bundle.lesson.pathSlug,
        downloadedAt: bundle.downloadedAt,
      });
    }
  }
  return out.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
}

/* ----------------------------------------------------------------- progress */

export interface LocalProgress {
  lessonSlug: string;
  stepIndex: number;
  completedAt: string | null;
  stuckCount: number;
  updatedAt: string;
}

export type ProgressMap = Record<string, LocalProgress>;

export interface OutboxItem {
  lessonSlug: string;
  stepIndex: number;
  completedAt: string | null;
  stuckCount: number;
  updatedAt: string;
}

function progressKey(userId: string): string {
  return `sabi.progress.${userId}`;
}

function outboxKey(userId: string): string {
  return `sabi.outbox.${userId}`;
}

export function loadProgress(userId: string): ProgressMap {
  return readJson<ProgressMap>(progressKey(userId), {});
}

export function saveProgress(userId: string, map: ProgressMap): void {
  writeJson(progressKey(userId), map);
}

export function loadOutbox(userId: string): OutboxItem[] {
  return readJson<OutboxItem[]>(outboxKey(userId), []);
}

export function saveOutbox(userId: string, items: OutboxItem[]): void {
  writeJson(outboxKey(userId), items);
}

export function mergeProgressRows(userId: string, rows: ProgressRow[]): ProgressMap {
  const map = loadProgress(userId);
  for (const row of rows) {
    const existing = map[row.lessonSlug];
    if (!existing || row.updatedAt > existing.updatedAt) {
      map[row.lessonSlug] = {
        lessonSlug: row.lessonSlug,
        stepIndex: row.stepIndex,
        completedAt: row.completedAt,
        stuckCount: row.stuckCount,
        updatedAt: row.updatedAt,
      };
    } else {
      existing.stepIndex = Math.max(existing.stepIndex, row.stepIndex);
      existing.stuckCount = Math.max(existing.stuckCount, row.stuckCount);
      existing.completedAt = existing.completedAt ?? row.completedAt;
    }
  }
  saveProgress(userId, map);
  return map;
}

export function recordProgress(
  userId: string,
  lessonSlug: string,
  patch: { stepIndex: number; completed?: boolean; stuck?: boolean },
): OutboxItem {
  const map = loadProgress(userId);
  const now = new Date().toISOString();
  const existing = map[lessonSlug];
  const row: LocalProgress = existing ?? {
    lessonSlug,
    stepIndex: 0,
    completedAt: null,
    stuckCount: 0,
    updatedAt: now,
  };
  row.stepIndex = Math.max(row.stepIndex, patch.stepIndex);
  row.updatedAt = now;
  if (patch.completed) row.completedAt = row.completedAt ?? now;
  if (patch.stuck) row.stuckCount += 1;
  map[lessonSlug] = row;
  saveProgress(userId, map);

  const item: OutboxItem = {
    lessonSlug,
    stepIndex: row.stepIndex,
    completedAt: row.completedAt,
    stuckCount: row.stuckCount,
    updatedAt: row.updatedAt,
  };
  const outbox = loadOutbox(userId).filter((entry) => entry.lessonSlug !== lessonSlug);
  outbox.push(item);
  saveOutbox(userId, outbox);
  return item;
}

export function removeOutboxItem(userId: string, lessonSlug: string, updatedAt: string): void {
  const outbox = loadOutbox(userId).filter(
    (entry) => !(entry.lessonSlug === lessonSlug && entry.updatedAt <= updatedAt),
  );
  saveOutbox(userId, outbox);
}
