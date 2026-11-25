import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/api';
import { clamp, errorMessage, formatDate, initials, percent, relativeTime, safeFileName } from '../src/lib/format';
import { taskForKey, tasksForApp, SANDBOX_TASKS } from '../src/lib/sandboxTasks';

describe('format helpers', () => {
  it('formats dates and copes with junk', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate('2026-01-15T10:00:00.000Z')).toMatch(/2026/);
  });

  it('clamps percentages and values', () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(0, 0)).toBe(0);
    expect(percent(9, 4)).toBe(100);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('builds initials and safe file names', () => {
    expect(initials('Baba Tunde')).toBe('BT');
    expect(initials('  mama   adaeze  ')).toBe('MA');
    expect(safeFileName('SABI Data 2026!!')).toBe('sabi-data-2026');
  });

  it('describes relative time', () => {
    const now = Date.parse('2026-03-01T12:00:00.000Z');
    expect(relativeTime('2026-03-01T11:59:40.000Z', now)).toBe('now');
    expect(relativeTime('2026-03-01T11:30:00.000Z', now)).toBe('30m');
    expect(relativeTime('2026-03-01T07:00:00.000Z', now)).toBe('5h');
    expect(relativeTime('2026-02-26T12:00:00.000Z', now)).toBe('3d');
    expect(relativeTime('nonsense', now)).toBe('—');
  });
});

describe('error messages', () => {
  const t = (key: string, fallback?: string) =>
    key === 'auth.resendIn' ? 'Please wait {seconds} seconds' : (fallback ?? `t:${key}`);

  it('maps API codes to translated keys', () => {
    expect(errorMessage(new ApiError(0, 'NETWORK', 'errors.network'), t)).toBe('t:errors.network');
    expect(errorMessage(new ApiError(401, 'UNAUTHORIZED', 'nope'), t)).toBe('t:errors.unauthorized');
    expect(errorMessage(new ApiError(404, 'NOT_FOUND', 'missing'), t)).toBe('t:errors.notFound');
    expect(errorMessage(new ApiError(423, 'LOCKED', 'locked'), t)).toBe('t:auth.locked');
  });

  it('keeps the API sentence for a wrong staff password', () => {
    const message = errorMessage(new ApiError(401, 'INVALID_LOGIN', 'Email or password is not correct.'), t);
    expect(message).toBe('Email or password is not correct.');
  });

  it('fills in the resend countdown', () => {
    const message = errorMessage(new ApiError(429, 'RESEND_COOLDOWN', 'wait', 42), t);
    expect(message).toContain('42');
  });

  it('falls back to a generic message for unknown failures', () => {
    expect(errorMessage(new Error('boom'), t)).toBe('boom');
    expect(errorMessage({}, t)).toBe('t:errors.generic');
  });
});

describe('sandbox practice tasks', () => {
  it('finds a task by key and ignores empty keys', () => {
    expect(taskForKey('sandbox.dialer.call')?.app).toBe('dialer');
    expect(taskForKey(null)).toBeNull();
    expect(taskForKey('not-a-task')).toBeNull();
  });

  it('groups tasks by app and gives every task a hint', () => {
    for (const task of Object.values(SANDBOX_TASKS)) {
      expect(task.hint.length).toBeGreaterThan(10);
      expect(task.instruction.length).toBeGreaterThan(10);
    }
    const dialer = tasksForApp('dialer');
    expect(dialer.length).toBeGreaterThan(0);
    expect(dialer.every((task) => task.app === 'dialer')).toBe(true);
  });
});
