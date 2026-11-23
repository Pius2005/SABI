import { Router } from 'express';
import { z } from 'zod';
import type { Lang } from '@sabi/shared';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate, normalizeLang } from '../auth';
import { fail, handleZod } from '../http';
import { answerQuestion } from '../assistant/answer';

const LANG = z.enum(['en', 'yo', 'ig', 'pcm']);
const TEXT = z.string().min(1).max(600);

const hits = new Map<string, number[]>();
function rateLimited(userId: string, max = 20): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(userId, list);
  return list.length > max;
}

export function createAssistantRouter(store: Store, env: Env): Router {
  const router = Router();
  // Scope the guard to this router's paths so an unknown /api/v1 route still
  // answers 404 instead of a misleading 401.
  router.use('/assistant', authenticate(store, env));

  router.post('/assistant/turn', async (req, res) => {
    try {
      if (rateLimited(req.user!.id)) {
        fail(res, 429, 'RATE_LIMITED', 'Please wait a moment before asking again.');
        return;
      }
      const body = z.object({ text: TEXT, lang: LANG.optional() }).parse(req.body);
      const started = Date.now();
      const lang = (body.lang ?? normalizeLang(undefined, req.user!.preferredLang)) as Lang;
      const reply = await answerQuestion({
        text: body.text,
        lang,
        store,
        env,
        userId: req.user!.id,
        latencyMs: Date.now() - started,
      });
      res.json(reply);
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not answer that. Please try again.');
    }
  });

  // Kept for the confirmation step the screen shows on a low-confidence answer.
  router.post('/assistant/confirm', async (req, res) => {
    try {
      const body = z.object({ text: TEXT, lang: LANG.optional() }).parse(req.body);
      const lang = (body.lang ?? normalizeLang(undefined, req.user!.preferredLang)) as Lang;
      const reply = await answerQuestion({
        text: body.text,
        lang,
        store,
        env,
        userId: req.user!.id,
      });
      res.json(reply);
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not answer that.');
    }
  });

  return router;
}
