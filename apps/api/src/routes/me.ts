import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate, publicUser } from '../auth';
import { decryptPhone } from '../crypto';
import { fail, handleZod } from '../http';

export function createMeRouter(store: Store, env: Env): Router {
  const router = Router();
  // Scope the guard to /me so public content routes are not shadowed.
  router.use('/me', authenticate(store, env));

  router.get('/me', (req, res) => {
    const user = req.user!;
    const consents = store.consentsFor(user.id);
    res.json({
      user: publicUser(user),
      consents: consents.map((c) => ({ type: c.type, granted: c.granted, createdAt: c.createdAt })),
      familyLinks: store.data.familyLinks
        .filter((l) => (l.learnerId === user.id || l.familyId === user.id) && !l.revokedAt)
        .map((l) => ({
          id: l.id,
          learnerId: l.learnerId,
          familyId: l.familyId,
          status: l.status,
          scopeProgress: l.scopeProgress,
          scopeScamAlerts: l.scopeScamAlerts,
          scopeTranscripts: l.scopeTranscripts,
          consentedAt: l.consentedAt,
        })),
      reminder: store.data.reminders.find((r) => r.userId === user.id) ?? null,
    });
  });

  router.patch('/me', (req, res) => {
    try {
      const body = z
        .object({
          displayName: z.string().min(1).max(60).optional(),
          preferredLang: z.enum(['en', 'yo', 'ig', 'pcm']).optional(),
          textSize: z.enum(['normal', 'large', 'xl']).optional(),
          theme: z.enum(['light', 'inverted']).optional(),
          reduceMotion: z.boolean().optional(),
          goalPathSlug: z.string().max(60).nullable().optional(),
        })
        .strict()
        .parse(req.body);
      const user = req.user!;
      Object.assign(user, body);
      store.save();
      res.json({ user: publicUser(user) });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not save your settings.');
    }
  });

  router.get('/me/export', (req, res) => {
    const user = req.user!;
    const phone = user.phoneEnc ? decryptPhone(user.phoneEnc, env) : null;
    const exportData = {
      exportedAt: new Date().toISOString(),
      app: env.appName,
      profile: { ...publicUser(user), phone },
      consents: store.consentsFor(user.id),
      progress: store.progressFor(user.id),
      sandboxAttempts: store.data.sandboxAttempts.filter((a) => a.userId === user.id),
      helpRequests: store.data.helpRequests.filter((h) => h.userId === user.id),
      familyLinks: store.data.familyLinks.filter((l) => l.learnerId === user.id || l.familyId === user.id),
      reminder: store.data.reminders.find((r) => r.userId === user.id) ?? null,
      assistantExchanges: store.data.voiceExchanges.filter((v) => v.userId === user.id),
      scamChecks: store.data.scamChecks.filter((s) => s.userId === user.id),
    };
    store.audit(user.id, 'export_data', 'user', user.id, null);
    res.setHeader('Content-Disposition', `attachment; filename="sabi-data-${user.id}.json"`);
    res.json(exportData);
  });

  router.delete('/me', (req, res) => {
    const user = req.user!;
    const oldPhoneHash = user.phoneHash;
    user.displayName = 'Deleted user';
    user.phoneEnc = null;
    user.phoneHash = null;
    user.phoneMasked = null;
    user.email = null;
    user.passwordHash = null;
    user.goalPathSlug = null;
    user.deletedAt = new Date().toISOString();
    store.data.progress = store.data.progress.filter((p) => p.userId !== user.id);
    store.data.sandboxAttempts = store.data.sandboxAttempts.filter((a) => a.userId !== user.id);
    store.data.consents = store.data.consents.filter((c) => c.userId !== user.id);
    store.data.refreshTokens = store.data.refreshTokens.filter((t) => t.userId !== user.id);
    store.data.otps = store.data.otps.filter((o) => o.phoneHash !== oldPhoneHash);
    store.data.reminders = store.data.reminders.filter((r) => r.userId !== user.id);
    for (const link of store.data.familyLinks) {
      if (link.learnerId === user.id || link.familyId === user.id) link.revokedAt = new Date().toISOString();
    }
    for (const exchange of store.data.voiceExchanges) {
      if (exchange.userId === user.id) {
        exchange.userId = null;
        exchange.transcript = null;
      }
    }
    store.audit(null, 'delete_account', 'user', user.id, null);
    store.save();
    res.json({ ok: true });
  });

  router.get('/me/consents', (req, res) => {
    res.json({ consents: store.consentsFor(req.user!.id) });
  });

  router.post('/me/consents', (req, res) => {
    try {
      const body = z
        .object({
          type: z.enum([
            'terms',
            'privacy',
            'ai_notice',
            'store_transcripts',
            'family_link',
            'analytics',
          ]),
          granted: z.boolean(),
        })
        .parse(req.body);
      const user = req.user!;
      store.data.consents.push({
        id: crypto.randomUUID(),
        userId: user.id,
        type: body.type,
        granted: body.granted,
        givenBy: null,
        createdAt: new Date().toISOString(),
      });
      if (body.type === 'family_link' && !body.granted) {
        for (const link of store.data.familyLinks) {
          if (link.learnerId === user.id) link.revokedAt = new Date().toISOString();
        }
      }
      store.audit(user.id, body.granted ? 'consent_granted' : 'consent_withdrawn', 'consent', body.type, null);
      store.save();
      res.json({ ok: true, consents: store.consentsFor(user.id) });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not save your choice.');
    }
  });

  return router;
}
