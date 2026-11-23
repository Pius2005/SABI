import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate } from '../auth';
import { fail, handleZod } from '../http';
import type { DbProgress } from '../db-types';

function publicRow(row: DbProgress) {
  return {
    lessonId: row.lessonSlug,
    lessonSlug: row.lessonSlug,
    stepIndex: row.stepIndex,
    completedAt: row.completedAt,
    stuckCount: row.stuckCount,
    updatedAt: row.updatedAt,
  };
}

export function createLearningRouter(store: Store, env: Env): Router {
  const router = Router();
  // Scope the guard to this router's paths so an unknown /api/v1 route still
  // answers 404 instead of a misleading 401.
  router.use(['/progress', '/sandbox'], authenticate(store, env));

  router.get('/progress', (req, res) => {
    const rows = store
      .progressFor(req.user!.id)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ progress: rows.map(publicRow) });
  });

  router.put('/progress/:lessonSlug', (req, res) => {
    try {
      const body = z
        .object({
          stepIndex: z.number().int().min(0).max(30),
          completed: z.boolean().optional(),
          stuck: z.boolean().optional(),
        })
        .parse(req.body);
      const lesson = store.lesson(req.params.lessonSlug);
      if (!lesson) {
        fail(res, 404, 'NOT_FOUND', 'That lesson was not found.');
        return;
      }
      const stepIndex = Math.min(body.stepIndex, lesson.steps.length - 1);
      let row = store.progress(req.user!.id, lesson.slug);
      const now = new Date().toISOString();
      if (!row) {
        row = {
          userId: req.user!.id,
          lessonSlug: lesson.slug,
          stepIndex,
          completedAt: body.completed ? now : null,
          stuckCount: body.stuck ? 1 : 0,
          updatedAt: now,
        };
        store.data.progress.push(row);
      } else {
        row.stepIndex = Math.max(row.stepIndex, stepIndex);
        row.updatedAt = now;
        if (body.completed) row.completedAt = row.completedAt ?? now;
        if (body.stuck) row.stuckCount += 1;
      }
      if (body.stuck) {
        store.audit(req.user!.id, 'stuck', 'lesson', lesson.slug, { stepIndex });
      }
      store.save();
      res.json({ progress: publicRow(row) });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not save progress.');
    }
  });

  router.post('/progress/sync', (req, res) => {
    try {
      const body = z
        .object({
          items: z
            .array(
              z.object({
                lessonSlug: z.string().min(1).max(80),
                stepIndex: z.number().int().min(0).max(30),
                completedAt: z.string().datetime().nullable().optional(),
                stuckCount: z.number().int().min(0).max(1000).optional(),
                updatedAt: z.string().datetime().optional(),
              }),
            )
            .max(200),
        })
        .parse(req.body);
      let applied = 0;
      for (const item of body.items) {
        const lesson = store.lesson(item.lessonSlug);
        if (!lesson) continue;
        const incomingAt = item.updatedAt ?? new Date().toISOString();
        const stepIndex = Math.min(item.stepIndex, lesson.steps.length - 1);
        let row = store.progress(req.user!.id, lesson.slug);
        if (!row) {
          row = {
            userId: req.user!.id,
            lessonSlug: lesson.slug,
            stepIndex,
            completedAt: item.completedAt ?? null,
            stuckCount: item.stuckCount ?? 0,
            updatedAt: incomingAt,
          };
          store.data.progress.push(row);
          applied += 1;
          continue;
        }
        if (incomingAt <= row.updatedAt) continue;
        row.stepIndex = Math.max(row.stepIndex, stepIndex);
        row.stuckCount = Math.max(row.stuckCount, item.stuckCount ?? 0);
        if (item.completedAt && !row.completedAt) row.completedAt = item.completedAt;
        row.updatedAt = incomingAt;
        applied += 1;
      }
      store.save();
      res.json({
        applied,
        progress: store.progressFor(req.user!.id).map(publicRow),
        syncedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not sync progress.');
    }
  });

  router.post('/sandbox/attempts', (req, res) => {
    try {
      const body = z
        .object({
          taskId: z.string().min(1).max(120),
          success: z.boolean(),
          hintsUsed: z.number().int().min(0).max(100).default(0),
        })
        .parse(req.body);
      store.data.sandboxAttempts.push({
        id: crypto.randomUUID(),
        userId: req.user!.id,
        taskId: body.taskId,
        success: body.success,
        hintsUsed: body.hintsUsed,
        createdAt: new Date().toISOString(),
      });
      store.save();
      res.status(201).json({ ok: true });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not save the practice attempt.');
    }
  });

  return router;
}
