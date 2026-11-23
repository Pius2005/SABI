import type { Response } from 'express';
import { ZodError } from 'zod';

export function fail(res: Response, status: number, code: string, message: string, extra: Record<string, unknown> = {}): void {
  res.status(status).json({ error: { code, message, ...extra } });
}

export function handleZod(res: Response, error: unknown): boolean {
  if (error instanceof ZodError) {
    fail(res, 400, 'VALIDATION', error.issues[0]?.message ?? 'Please check the information.', {
      fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return true;
  }
  return false;
}

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
