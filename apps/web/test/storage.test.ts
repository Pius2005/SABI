import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadOutbox,
  loadProgress,
  loadSession,
  mergeProgressRows,
  putBundle,
  getBundle,
  bundleList,
  removeBundle,
  recordProgress,
  removeOutboxItem,
  saveSession,
  takePendingSettings,
  queueSettingsPatch,
} from '../src/lib/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('session storage', () => {
  it('round-trips a session and rejects an incomplete one', () => {
    saveSession({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', displayName: 'Ada' } as never,
    });
    expect(loadSession()?.user.id).toBe('u1');

    localStorage.setItem('sabi.session.v1', JSON.stringify({ accessToken: 'a' }));
    expect(loadSession()).toBeNull();

    localStorage.setItem('sabi.session.v1', 'not json');
    expect(loadSession()).toBeNull();
  });
});

describe('progress storage', () => {
  it('keeps the furthest step and counts stuck moments', () => {
    recordProgress('u1', 'lesson-a', { stepIndex: 2 });
    const row = recordProgress('u1', 'lesson-a', { stepIndex: 1, stuck: true });
    expect(row.stepIndex).toBe(2);
    expect(row.stuckCount).toBe(1);
    expect(loadProgress('u1')['lesson-a']?.stepIndex).toBe(2);
    expect(loadOutbox('u1')).toHaveLength(1);
  });

  it('records completion once', () => {
    recordProgress('u1', 'lesson-a', { stepIndex: 3, completed: true });
    const second = recordProgress('u1', 'lesson-a', { stepIndex: 4, completed: true });
    expect(second.completedAt).toBeTruthy();
    const third = recordProgress('u1', 'lesson-a', { stepIndex: 5 });
    expect(third.completedAt).toBe(second.completedAt);
  });

  it('prefers the server row when it is newer', () => {
    recordProgress('u2', 'lesson-b', { stepIndex: 1 });
    mergeProgressRows('u2', [
      {
        lessonId: 'lesson-b',
        lessonSlug: 'lesson-b',
        stepIndex: 4,
        completedAt: '2026-01-01T00:00:00.000Z',
        stuckCount: 0,
        updatedAt: '2099-01-01T00:00:00.000Z',
      },
    ]);
    expect(loadProgress('u2')['lesson-b']?.stepIndex).toBe(4);
  });

  it('drops an outbox item once it is synced', () => {
    const item = recordProgress('u3', 'lesson-c', { stepIndex: 1 });
    removeOutboxItem('u3', 'lesson-c', item.updatedAt);
    expect(loadOutbox('u3')).toHaveLength(0);
  });
});

describe('offline bundles', () => {
  it('stores, lists and removes a downloaded lesson', () => {
    putBundle('yo', 'lesson-a', {
      lesson: { slug: 'lesson-a', title: 'Ẹ̀kọ́', pathSlug: 'phone-basics' } as never,
      path: null,
      strings: {},
      downloadedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(getBundle('yo', 'lesson-a')?.lesson.title).toBe('Ẹ̀kọ́');
    expect(bundleList()).toHaveLength(1);
    expect(bundleList()[0].lang).toBe('yo');

    removeBundle('yo', 'lesson-a');
    expect(getBundle('yo', 'lesson-a')).toBeNull();
    expect(bundleList()).toHaveLength(0);
  });
});

describe('pending settings', () => {
  it('queues a patch and clears it when taken', () => {
    queueSettingsPatch({ textSize: 'xl' });
    queueSettingsPatch({ theme: 'inverted' });
    expect(takePendingSettings()).toEqual({ textSize: 'xl', theme: 'inverted' });
    expect(takePendingSettings()).toBeNull();
  });
});
