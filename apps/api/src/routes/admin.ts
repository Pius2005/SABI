import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate, requireRole } from '../auth';
import { translationCoverage } from '../content-service';
import { fail, handleZod } from '../http';

export function createAdminRouter(store: Store, env: Env): Router {
  const router = Router();
  // Scope the guard to the admin paths so an unknown /api/v1 route still
  // answers 404 instead of a misleading 401.
  router.use('/admin', authenticate(store, env), requireRole('ADMIN'));

  router.get('/admin/translations', (req, res) => {
    const lang = typeof req.query.lang === 'string' ? req.query.lang : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 40));
    let rows = store.data.translations.slice();
    if (lang) rows = rows.filter((r) => r.lang === lang);
    if (status) rows = rows.filter((r) => r.status === status);
    if (q) rows = rows.filter((r) => r.key.toLowerCase().includes(q) || r.text.toLowerCase().includes(q));
    rows.sort((a, b) => a.key.localeCompare(b.key) || a.lang.localeCompare(b.lang));
    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit);
    res.json({ items, total, page, limit, coverage: translationCoverage(store, env) });
  });

  router.patch('/admin/translations', (req, res) => {
    try {
      const body = z
        .object({
          key: z.string().min(1).max(200),
          lang: z.enum(['en', 'yo', 'ig', 'pcm']),
          text: z.string().max(2000).optional(),
          status: z.enum(['draft', 'machine', 'needs_review', 'approved']).optional(),
        })
        .parse(req.body);
      let row = store.translation(body.key, body.lang);
      if (!row) {
        row = {
          key: body.key,
          lang: body.lang,
          text: body.text ?? '',
          status: body.status ?? 'draft',
          reviewerId: null,
          reviewedAt: null,
        };
        store.data.translations.push(row);
      } else {
        if (body.text !== undefined) row.text = body.text;
        if (body.status !== undefined) row.status = body.status;
      }
      if (body.status === 'approved') {
        row.reviewerId = req.user!.id;
        row.reviewedAt = new Date().toISOString();
      }
      store.audit(req.user!.id, 'translation_updated', 'translation', `${body.key}|${body.lang}`, {
        status: row.status,
      });
      store.save();
      res.json({ translation: row });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not update the translation.');
    }
  });

  router.get('/admin/analytics', (req, res) => {
    const learners = store.data.users.filter((u) => u.role === 'LEARNER' && !u.deletedAt);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activeIds = new Set(store.data.progress.filter((p) => p.updatedAt >= weekAgo).map((p) => p.userId));
    const analytics = {
      learners: learners.length,
      activeLearners: activeIds.size,
      lessonsCompleted: store.data.progress.filter((p) => p.completedAt).length,
      stuckEvents: store.data.progress.reduce((sum, p) => sum + p.stuckCount, 0),
      helpOpen: store.data.helpRequests.filter((h) => h.status === 'open').length,
      assistantTurns: store.data.voiceExchanges.length,
      scamChecks: store.data.scamChecks.length,
      sandboxAttempts: store.data.sandboxAttempts.length,
      translationCoverage: translationCoverage(store, env),
    };
    res.json({ analytics });
  });

  router.get('/admin/audit-logs', (req, res) => {
    res.json({ logs: store.data.auditLogs.slice(0, 200) });
  });

  router.get('/admin/users', (req, res) => {
    res.json({
      users: store.data.users
        .filter((u) => !u.deletedAt)
        .map((u) => ({
          id: u.id,
          role: u.role,
          name: u.displayName,
          lang: u.preferredLang,
          phone: u.phoneMasked,
          email: u.email,
          createdAt: u.createdAt,
        })),
    });
  });

  router.get('/admin/scam-examples', (req, res) => {
    res.json({ examples: store.data.scamExamples });
  });

  router.post('/admin/scam-examples', (req, res) => {
    try {
      const body = z
        .object({
          type: z.string().min(2).max(60),
          lang: z.enum(['en', 'yo', 'ig', 'pcm']),
          text: z.string().min(5).max(2000),
          isScam: z.boolean(),
          redFlags: z.array(z.string().max(60)).max(12).default([]),
        })
        .parse(req.body);
      const example = { id: crypto.randomUUID(), ...body };
      store.data.scamExamples.unshift(example);
      store.audit(req.user!.id, 'scam_example_added', 'scam_example', example.id, { type: body.type });
      store.save();
      res.status(201).json({ example });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not add the example.');
    }
  });

  router.delete('/admin/scam-examples/:id', (req, res) => {
    const before = store.data.scamExamples.length;
    store.data.scamExamples = store.data.scamExamples.filter((s) => s.id !== req.params.id);
    if (store.data.scamExamples.length === before) {
      fail(res, 404, 'NOT_FOUND', 'That example was not found.');
      return;
    }
    store.audit(req.user!.id, 'scam_example_deleted', 'scam_example', req.params.id, null);
    store.save();
    res.json({ ok: true });
  });

  router.get('/admin/glossary', (req, res) => {
    res.json({ glossary: store.data.glossary });
  });

  return router;
}
