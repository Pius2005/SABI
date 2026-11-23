import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { analyzeMessage } from '@sabi/shared';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate, normalizeLang } from '../auth';
import { fail, handleZod } from '../http';

export function createScamRouter(store: Store, env: Env): Router {
  const router = Router();
  // Scope the guard to /scam so an unknown /api/v1 route still answers 404.
  router.use('/scam', authenticate(store, env));

  router.post('/scam/check', (req, res) => {
    try {
      const body = z.object({ text: z.string().min(2).max(2000) }).parse(req.body);
      const result = analyzeMessage(body.text);
      store.data.scamChecks.push({
        id: crypto.randomUUID(),
        userId: req.user!.id,
        verdict: result.verdict,
        createdAt: new Date().toISOString(),
      });
      store.audit(req.user!.id, 'scam_check', 'scam_check', null, {
        verdict: result.verdict,
        redFlags: result.redFlags,
      });
      store.save();
      res.json({
        verdict: result.verdict,
        confidence: result.confidence,
        headline: result.headline,
        reasons: result.reasons,
        nextSteps: result.nextSteps,
        redFlags: result.redFlags,
        critical: result.critical,
      });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not check that message.');
    }
  });

  router.get('/scam/examples', (req, res) => {
    const lang = req.query.lang ? normalizeLang(req.query.lang) : null;
    const type = typeof req.query.type === 'string' ? req.query.type : null;
    const examples = store.data.scamExamples.filter(
      (s) => (!lang || s.lang === lang) && (!type || s.type === type),
    );
    res.json({ examples });
  });

  return router;
}
