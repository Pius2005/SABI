import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { analyzeMessage, type Lang } from '@sabi/shared';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate, normalizeLang } from '../auth';
import { fail, handleZod } from '../http';
import { getSttProvider } from '../providers';
import { answerQuestion } from '../voice/assistant';
import { readCachedAudio, synthesizeCached } from '../tts';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const hits = new Map<string, number[]>();
function rateLimited(userId: string, max = 20): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(userId, list);
  return list.length > max;
}

export function createVoiceRouter(store: Store, env: Env): Router {
  const router = Router();
  // Scope the guard to this router's paths so an unknown /api/v1 route still
  // answers 404 instead of a misleading 401.
  router.use(['/voice', '/tts', '/scam'], authenticate(store, env));

  router.post('/voice/turn', upload.single('audio'), async (req, res) => {
    try {
      if (rateLimited(req.user!.id)) {
        fail(res, 429, 'RATE_LIMITED', 'Please wait a moment before asking again.');
        return;
      }
      const started = Date.now();
      const lang = normalizeLang(req.body?.lang, req.user!.preferredLang) as Lang;
      let text = String(req.body?.text ?? '').slice(0, 600);
      let confidence = 1;
      let isTyped = true;

      if (req.file) {
        isTyped = false;
        try {
          const stt = getSttProvider(env, lang);
          const result = await stt.transcribe(req.file.buffer, {
            languageHint: lang,
            mimeType: req.file.mimetype || 'audio/webm',
          });
          text = result.text;
          confidence = result.confidence;
        } catch {
          text = '';
          confidence = 0;
        }
        // Audio is discarded here. It is never written to disk or stored.
      }

      if (!text && !isTyped) {
        const reply = await answerQuestion({
          text: '',
          lang,
          confidence: 0,
          store,
          env,
          userId: req.user!.id,
          isTyped: false,
          latencyMs: Date.now() - started,
        });
        res.json(reply);
        return;
      }

      const reply = await answerQuestion({
        text,
        lang,
        confidence,
        store,
        env,
        userId: req.user!.id,
        isTyped,
        latencyMs: Date.now() - started,
      });
      res.json(reply);
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not answer that. Please try again.');
    }
  });

  router.post('/voice/confirm', async (req, res) => {
    try {
      const body = z
        .object({ text: z.string().min(1).max(600), lang: z.enum(['en', 'yo', 'ig', 'pcm']).optional() })
        .parse(req.body);
      const reply = await answerQuestion({
        text: body.text,
        lang: body.lang ?? req.user!.preferredLang,
        confidence: 1,
        store,
        env,
        userId: req.user!.id,
        isTyped: true,
      });
      res.json(reply);
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not answer that.');
    }
  });

  router.post('/tts', async (req, res) => {
    try {
      const body = z
        .object({
          text: z.string().min(1).max(400),
          lang: z.enum(['en', 'yo', 'ig', 'pcm']).optional(),
          speed: z.number().min(0.5).max(1.5).optional(),
        })
        .parse(req.body);
      const lang = body.lang ?? req.user!.preferredLang;
      const result = await synthesizeCached(body.text, lang, body.speed ?? 0.9, env);
      res.json({
        audioUrl: `/api/v1/tts/audio/${result.hash}`,
        mimeType: result.mimeType,
        hash: result.hash,
        cached: true,
      });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not make the audio.');
    }
  });

  router.get('/tts/audio/:hash', (req, res) => {
    const audio = readCachedAudio(req.params.hash);
    if (!audio) {
      fail(res, 404, 'NOT_FOUND', 'That audio is not available.');
      return;
    }
    res.setHeader('Content-Type', audio.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(audio.buffer);
  });

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
