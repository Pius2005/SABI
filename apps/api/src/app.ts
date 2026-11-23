import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { APP_TAGLINE, LANGUAGE_GREETINGS, LANGUAGE_NAMES, LANGUAGES } from '@sabi/shared';
import type { Env } from './env';
import type { Store } from './store';
import { createAuthRouter } from './routes/auth';
import { createMeRouter } from './routes/me';
import { createContentRouter } from './routes/content';
import { createLearningRouter } from './routes/learning';
import { createVoiceRouter } from './routes/voice';
import { createPeopleRouter } from './routes/people';
import { createAdminRouter } from './routes/admin';

export interface AppContext {
  store: Store;
  env: Env;
}

export function createApp(ctx: AppContext) {
  const { store, env } = ctx;
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  const origins = new Set([
    env.webOrigin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    // The API also serves the built PWA, so it must accept its own origin.
    `http://localhost:${env.port}`,
    `http://127.0.0.1:${env.port}`,
  ]);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.has(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '200kb' }));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      if (env.nodeEnv === 'test') return;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`;
      console.log(`[api] ${line}`);
    });
    next();
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true, appName: env.appName, time: new Date().toISOString() });
  });

  app.get('/api/v1/config', (_req, res) => {
    res.json({
      appName: env.appName,
      tagline: APP_TAGLINE,
      languages: LANGUAGES.map((code) => ({ code, name: LANGUAGE_NAMES[code], greeting: LANGUAGE_GREETINGS[code] })),
      pilotMode: env.allowUnreviewedTranslations,
      providers: {
        stt: env.sttProvider,
        tts: env.ttsProvider,
        llm: env.llmProvider,
        sms: env.smsProvider,
      },
      retention: {
        retainAudio: env.retainAudio,
        audioRetentionHours: env.audioRetentionHours,
        transcriptRetentionDays: env.transcriptRetentionDays,
      },
      confThreshold: env.confThreshold,
      demo: env.nodeEnv !== 'production',
    });
  });

  app.use('/api/v1', createAuthRouter(store, env));
  app.use('/api/v1', createMeRouter(store, env));
  app.use('/api/v1', createContentRouter(store, env));
  app.use('/api/v1', createLearningRouter(store, env));
  app.use('/api/v1', createVoiceRouter(store, env));
  app.use('/api/v1', createPeopleRouter(store, env));
  app.use('/api/v1', createAdminRouter(store, env));

  // Serve the built PWA when it exists (single-process deployment).
  const webDist = path.resolve(fileURLToPath(new URL('../../web/dist', import.meta.url)));
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That endpoint was not found.' } });
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error.message === 'Not allowed by CORS') {
      res.status(403).json({ error: { code: 'CORS', message: 'Origin not allowed.' } });
      return;
    }
    console.error('[api] unhandled error', error.message);
    res.status(500).json({ error: { code: 'ERROR', message: 'Something went wrong. Please try again.' } });
  });

  return app;
}
