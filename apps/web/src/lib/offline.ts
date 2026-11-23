import { useEffect, useState } from 'react';
import type { Lang, LessonDetail, PathDetail, ProgressRow } from '@sabi/shared';
import { apiFetch, ApiError } from './api';
import {
  getBundle,
  loadOutbox,
  loadProgress,
  mergeProgressRows,
  putBundle,
  recordProgress,
  removeOutboxItem,
  saveOutbox,
  type OfflineBundle,
  type ProgressMap,
} from './storage';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}

interface BundleResponse {
  lesson: LessonDetail;
  path: PathDetail | null;
  strings: Record<string, string>;
  downloadedAt: string;
}

export async function downloadLesson(lang: Lang, slug: string): Promise<OfflineBundle> {
  const data = await apiFetch<BundleResponse>(`/lessons/${slug}/bundle?lang=${encodeURIComponent(lang)}`);
  const bundle: OfflineBundle = {
    lesson: data.lesson,
    path: data.path,
    strings: data.strings ?? {},
    downloadedAt: data.downloadedAt ?? new Date().toISOString(),
  };
  if (!putBundle(lang, slug, bundle)) {
    throw new ApiError(0, 'STORAGE_FULL', 'There is not enough space on this phone. Free some space and try again.');
  }
  return bundle;
}

export async function downloadPath(
  lang: Lang,
  pathSlug: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const data = await apiFetch<{ path: PathDetail }>(`/paths/${pathSlug}?lang=${encodeURIComponent(lang)}`);
  const lessons = data.path.lessons;
  let done = 0;
  onProgress?.(0, lessons.length);
  for (const lesson of lessons) {
    await downloadLesson(lang, lesson.slug);
    done += 1;
    onProgress?.(done, lessons.length);
  }
  return done;
}

export function offlineLesson(lang: Lang, slug: string): OfflineBundle | null {
  return getBundle(lang, slug);
}

export async function pushProgress(
  userId: string,
  lessonSlug: string,
  patch: { stepIndex: number; completed?: boolean; stuck?: boolean },
): Promise<void> {
  const item = recordProgress(userId, lessonSlug, patch);
  try {
    const response = await apiFetch<{ progress: ProgressRow }>(`/progress/${encodeURIComponent(lessonSlug)}`, {
      method: 'PUT',
      body: patch,
    });
    removeOutboxItem(userId, lessonSlug, item.updatedAt);
    mergeProgressRows(userId, [response.progress]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NETWORK') return;
    // Keep the local row and the outbox item: the next sync will retry.
  }
}

export async function syncOutbox(userId: string): Promise<number> {
  const outbox = loadOutbox(userId);
  if (outbox.length === 0) return 0;
  const startedAt = new Date().toISOString();
  const response = await apiFetch<{ applied: number; progress: ProgressRow[]; syncedAt: string }>('/progress/sync', {
    method: 'POST',
    body: {
      items: outbox.map((item) => ({
        lessonSlug: item.lessonSlug,
        stepIndex: item.stepIndex,
        completedAt: item.completedAt,
        stuckCount: item.stuckCount,
        updatedAt: item.updatedAt,
      })),
    },
  });
  mergeProgressRows(userId, response.progress);
  saveOutbox(
    userId,
    loadOutbox(userId).filter((item) => item.updatedAt > startedAt),
  );
  return response.applied;
}

export async function hydrateProgress(userId: string): Promise<ProgressMap> {
  const response = await apiFetch<{ progress: ProgressRow[] }>('/progress');
  const map = mergeProgressRows(userId, response.progress);
  try {
    await syncOutbox(userId);
  } catch {
    /* still offline: the outbox stays */
  }
  return map;
}

export function completedCount(map: ProgressMap): number {
  return Object.values(map).filter((row) => row.completedAt).length;
}

export function progressForLesson(map: ProgressMap, slug: string) {
  return map[slug] ?? null;
}

export function localMap(userId: string): ProgressMap {
  return loadProgress(userId);
}
