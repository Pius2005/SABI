import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate, requireRole } from '../auth';
import { decryptPhone, encryptPhone, hashPhone, isValidNgPhone, maskPhone, normalizePhone } from '../crypto';
import { fail, handleZod } from '../http';
import { getSmsProvider, getWhatsAppProvider } from '../providers';
import type { DbUser } from '../db-types';

function summaryFor(store: Store, learner: DbUser) {
  const rows = store.progressFor(learner.id);
  const completed = rows.filter((r) => r.completedAt);
  const last = rows.map((r) => r.updatedAt).sort().pop() ?? null;
  return {
    learnerId: learner.id,
    name: learner.displayName,
    lang: learner.preferredLang,
    lessonsCompleted: completed.length,
    lessonsStarted: rows.length,
    stuckCount: rows.reduce((sum, r) => sum + r.stuckCount, 0),
    lastActive: last,
    helpOpen: store.data.helpRequests.filter((h) => h.userId === learner.id && h.status !== 'resolved').length,
  };
}

/**
 * A masked phone ("0803 *** 0001") cannot receive a message. Decrypt the real
 * number when we have it and never fall back to the display mask.
 */
function reachablePhone(user: DbUser | null | undefined, env: Env): string | null {
  if (!user?.phoneEnc) return null;
  const phone = decryptPhone(user.phoneEnc, env);
  return isValidNgPhone(phone) ? normalizePhone(phone) : null;
}

function canFacilitate(store: Store, userId: string, role: string, groupId: string): boolean {
  const group = store.data.groups.find((g) => g.id === groupId);
  if (!group) return false;
  return role === 'ADMIN' || group.facilitatorId === userId;
}

export function createPeopleRouter(store: Store, env: Env): Router {
  const router = Router();
  // Scope the guard to this router's paths so an unknown /api/v1 route still
  // answers 404 instead of a misleading 401.
  router.use(['/help-requests', '/groups', '/family', '/reminders'], authenticate(store, env));

  // ---- Help requests -------------------------------------------------------
  router.post('/help-requests', (req, res) => {
    try {
      const body = z
        .object({
          type: z.enum(['call_back', 'whatsapp', 'facilitator']),
          context: z.record(z.unknown()).optional(),
        })
        .parse(req.body);
      const request = {
        id: crypto.randomUUID(),
        userId: req.user!.id,
        type: body.type,
        context: body.context ?? null,
        status: 'open' as const,
        createdAt: new Date().toISOString(),
        contactedAt: null,
        resolvedAt: null,
      };
      store.data.helpRequests.unshift(request);
      store.audit(req.user!.id, 'help_requested', 'help_request', request.id, { type: body.type });
      store.save();
      res.status(201).json({ request });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not send the request.');
    }
  });

  router.get('/help-requests', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    const allowed = new Set(store.learnerIdsForStaff(req.user!.id, req.user!.role));
    const requests = store.data.helpRequests
      .filter((h) => allowed.has(h.userId))
      .map((h) => ({
        ...h,
        learnerName: store.userById(h.userId)?.displayName ?? 'Learner',
      }));
    res.json({ requests });
  });

  router.patch('/help-requests/:id', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    try {
      const body = z.object({ status: z.enum(['open', 'contacted', 'resolved']) }).parse(req.body);
      const request = store.data.helpRequests.find((h) => h.id === req.params.id);
      if (!request) {
        fail(res, 404, 'NOT_FOUND', 'That request was not found.');
        return;
      }
      const allowed = new Set(store.learnerIdsForStaff(req.user!.id, req.user!.role));
      if (!allowed.has(request.userId)) {
        fail(res, 403, 'FORBIDDEN', 'You do not have access to that request.');
        return;
      }
      request.status = body.status;
      if (body.status === 'contacted') request.contactedAt = new Date().toISOString();
      if (body.status === 'resolved') request.resolvedAt = new Date().toISOString();
      store.audit(req.user!.id, `help_${body.status}`, 'help_request', request.id, null);
      store.save();
      res.json({ request });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not update the request.');
    }
  });

  // ---- Facilitator groups --------------------------------------------------
  router.get('/groups', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    const groups = req.user!.role === 'ADMIN' ? store.data.groups : store.groupsForFacilitator(req.user!.id);
    res.json({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        venue: g.venue,
        schedule: g.schedule,
        facilitatorId: g.facilitatorId,
        notes: g.notes,
        memberCount: store.memberIds(g.id).length,
      })),
    });
  });

  router.post('/groups', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    try {
      const body = z
        .object({
          name: z.string().min(2).max(80),
          venue: z.string().max(80).optional(),
          schedule: z.string().max(80).optional(),
        })
        .parse(req.body);
      const group = {
        id: crypto.randomUUID(),
        name: body.name,
        venue: body.venue ?? null,
        schedule: body.schedule ?? null,
        facilitatorId: req.user!.id,
        notes: '',
        createdAt: new Date().toISOString(),
      };
      store.data.groups.push(group);
      store.audit(req.user!.id, 'group_created', 'group', group.id, { name: group.name });
      store.save();
      res.status(201).json({ group: { ...group, memberCount: 0 } });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not create the group.');
    }
  });

  const addLearner = (name: string, phone: string): { user?: DbUser; error?: string } => {
    if (!isValidNgPhone(phone)) return { error: 'Enter a correct Nigerian phone number.' };
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized, env);
    const existing = store.userByPhoneHash(phoneHash);
    if (existing && existing.role !== 'LEARNER') return { error: 'That number belongs to a staff account.' };
    if (existing) return { user: existing };
    const user: DbUser = {
      id: crypto.randomUUID(),
      role: 'LEARNER',
      phoneEnc: encryptPhone(normalized, env),
      phoneHash,
      phoneMasked: maskPhone(normalized),
      email: null,
      passwordHash: null,
      displayName: name.trim() || 'Learner',
      preferredLang: 'en',
      textSize: 'large',
      theme: 'light',
      voiceSpeed: 0.9,
      autoRead: true,
      reduceMotion: false,
      goalPathSlug: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    store.data.users.push(user);
    return { user };
  };

  router.post('/groups/:id/members', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    try {
      if (!canFacilitate(store, req.user!.id, req.user!.role, req.params.id)) {
        fail(res, 403, 'FORBIDDEN', 'You do not have access to that group.');
        return;
      }
      const body = z
        .object({ name: z.string().min(1).max(60), phone: z.string().min(7).max(20) })
        .parse(req.body);
      const result = addLearner(body.name, body.phone);
      if (result.error || !result.user) {
        fail(res, 400, 'INVALID_LEARNER', result.error ?? 'Could not add the learner.');
        return;
      }
      if (!store.data.groupMembers.some((m) => m.groupId === req.params.id && m.userId === result.user!.id)) {
        store.data.groupMembers.push({
          groupId: req.params.id,
          userId: result.user.id,
          addedAt: new Date().toISOString(),
        });
      }
      store.audit(req.user!.id, 'learner_added', 'group', req.params.id, { learnerId: result.user.id });
      store.save();
      res.status(201).json({ learner: { id: result.user.id, name: result.user.displayName } });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not add the learner.');
    }
  });

  router.post('/groups/:id/import', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    try {
      if (!canFacilitate(store, req.user!.id, req.user!.role, req.params.id)) {
        fail(res, 403, 'FORBIDDEN', 'You do not have access to that group.');
        return;
      }
      const body = z.object({ csv: z.string().min(3).max(20000) }).parse(req.body);
      const lines = body.csv.split(/\r?\n/).filter((l) => l.trim());
      const failed: Array<{ row: number; reason: string }> = [];
      let added = 0;
      lines.forEach((line, index) => {
        const rowNumber = index + 1;
        if (index === 0 && /^name\s*,\s*phone/i.test(line)) return;
        const [name, phone] = line.split(',').map((p) => p.trim());
        if (!name || !phone) {
          failed.push({ row: rowNumber, reason: 'Use name,phone on each line.' });
          return;
        }
        const result = addLearner(name, phone);
        if (result.error || !result.user) {
          failed.push({ row: rowNumber, reason: result.error ?? 'Could not add.' });
          return;
        }
        if (!store.data.groupMembers.some((m) => m.groupId === req.params.id && m.userId === result.user!.id)) {
          store.data.groupMembers.push({
            groupId: req.params.id,
            userId: result.user.id,
            addedAt: new Date().toISOString(),
          });
        }
        added += 1;
      });
      store.audit(req.user!.id, 'learners_imported', 'group', req.params.id, { added, failed: failed.length });
      store.save();
      res.json({ added, failed });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not import the list.');
    }
  });

  router.get('/groups/:id/progress', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    if (!canFacilitate(store, req.user!.id, req.user!.role, req.params.id)) {
      fail(res, 403, 'FORBIDDEN', 'You do not have access to that group.');
      return;
    }
    const ids = store.memberIds(req.params.id);
    const learners = ids
      .map((id) => store.userById(id))
      .filter((u): u is DbUser => Boolean(u))
      .map((u) => summaryFor(store, u));
    res.json({ learners });
  });

  router.post('/groups/:id/notes', requireRole('FACILITATOR', 'ADMIN'), (req, res) => {
    try {
      if (!canFacilitate(store, req.user!.id, req.user!.role, req.params.id)) {
        fail(res, 403, 'FORBIDDEN', 'You do not have access to that group.');
        return;
      }
      const body = z.object({ notes: z.string().max(4000) }).parse(req.body);
      const group = store.data.groups.find((g) => g.id === req.params.id)!;
      group.notes = body.notes;
      store.audit(req.user!.id, 'group_notes', 'group', group.id, null);
      store.save();
      res.json({ ok: true });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not save the notes.');
    }
  });

  // ---- Family link ---------------------------------------------------------
  router.post('/family/invite', requireRole('LEARNER'), async (req, res) => {
    try {
      const body = z
        .object({
          phone: z.string().min(7).max(20),
          scopeProgress: z.boolean().default(true),
          scopeScamAlerts: z.boolean().default(false),
          scopeTranscripts: z.boolean().default(false),
        })
        .parse(req.body);
      if (!store.activeConsent(req.user!.id, 'family_link')) {
        fail(res, 403, 'CONSENT_REQUIRED', 'Please agree to the family link first.');
        return;
      }
      if (!isValidNgPhone(body.phone)) {
        fail(res, 400, 'INVALID_PHONE', 'Enter a correct Nigerian phone number.');
        return;
      }
      const familyUser = store.userByPhoneHash(hashPhone(normalizePhone(body.phone), env));
      if (!familyUser || familyUser.role !== 'FAMILY') {
        fail(res, 404, 'NOT_FOUND', 'Ask your family member to create a family account first.');
        return;
      }
      const existing = store.data.familyLinks.find(
        (l) => l.learnerId === req.user!.id && l.familyId === familyUser.id && !l.revokedAt,
      );
      if (existing) {
        res.json({ link: existing });
        return;
      }
      const link = {
        id: crypto.randomUUID(),
        learnerId: req.user!.id,
        familyId: familyUser.id,
        status: 'pending' as const,
        scopeProgress: body.scopeProgress,
        scopeScamAlerts: body.scopeScamAlerts,
        scopeTranscripts: body.scopeTranscripts,
        consentedAt: new Date().toISOString(),
        revokedAt: null,
      };
      store.data.familyLinks.push(link);
      store.audit(req.user!.id, 'family_invited', 'family_link', link.id, null);
      store.save();
      try {
        await getSmsProvider(env).send(
          normalizePhone(body.phone),
          `${req.user!.displayName} invited you to see their ${env.appName} progress. Open the app to accept.`,
        );
      } catch {
        /* mock provider */
      }
      res.status(201).json({ link });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not send the invitation.');
    }
  });

  router.get('/family/learners', requireRole('FAMILY', 'LEARNER', 'ADMIN'), (req, res) => {
    const user = req.user!;
    const links = store.data.familyLinks.filter(
      (l) =>
        !l.revokedAt &&
        (user.role === 'ADMIN' ? true : user.role === 'FAMILY' ? l.familyId === user.id : l.learnerId === user.id),
    );
    const learners = links.map((link) => {
      const learner = store.userById(link.learnerId);
      const rows = learner ? store.progressFor(learner.id) : [];
      const progress =
        link.scopeProgress && learner
          ? rows.map((r) => ({
              lessonSlug: r.lessonSlug,
              title: store.lesson(r.lessonSlug)?.title ?? r.lessonSlug,
              stepIndex: r.stepIndex,
              completed: Boolean(r.completedAt),
              updatedAt: r.updatedAt,
            }))
          : [];
      return {
        linkId: link.id,
        status: link.status,
        learnerId: link.learnerId,
        name: learner?.displayName ?? 'Learner',
        lang: learner?.preferredLang ?? 'en',
        scopeProgress: link.scopeProgress,
        scopeScamAlerts: link.scopeScamAlerts,
        scopeTranscripts: link.scopeTranscripts,
        progress,
        lessonsCompleted: progress.filter((p) => p.completed).length,
      };
    });
    res.json({ links: learners });
  });

  router.post('/family/accept', requireRole('FAMILY'), (req, res) => {
    try {
      const body = z.object({ linkId: z.string().min(1) }).parse(req.body);
      const link = store.data.familyLinks.find((l) => l.id === body.linkId);
      if (!link || link.familyId !== req.user!.id || link.revokedAt) {
        fail(res, 404, 'NOT_FOUND', 'That invitation was not found.');
        return;
      }
      link.status = 'active';
      link.consentedAt = new Date().toISOString();
      store.audit(req.user!.id, 'family_accepted', 'family_link', link.id, null);
      store.save();
      res.json({ link });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not accept the invitation.');
    }
  });

  router.delete('/family/:id', (req, res) => {
    const link = store.data.familyLinks.find((l) => l.id === req.params.id);
    if (!link || (link.learnerId !== req.user!.id && link.familyId !== req.user!.id)) {
      fail(res, 404, 'NOT_FOUND', 'That link was not found.');
      return;
    }
    link.revokedAt = new Date().toISOString();
    store.audit(req.user!.id, 'family_revoked', 'family_link', link.id, null);
    store.save();
    res.json({ ok: true });
  });

  router.post('/family/encourage', requireRole('FAMILY'), async (req, res) => {
    try {
      const body = z.object({ linkId: z.string(), message: z.string().min(1).max(240) }).parse(req.body);
      const link = store.data.familyLinks.find((l) => l.id === body.linkId && l.familyId === req.user!.id && !l.revokedAt);
      if (!link) {
        fail(res, 404, 'NOT_FOUND', 'That link was not found.');
        return;
      }
      const learner = store.userById(link.learnerId);
      const learnerPhone = reachablePhone(learner, env);
      if (learnerPhone) {
        await getWhatsAppProvider(env).send(learnerPhone, body.message);
      }
      store.audit(req.user!.id, 'family_encouragement', 'family_link', link.id, null);
      store.save();
      res.json({ ok: true });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not send the message.');
    }
  });

  // ---- Reminders -----------------------------------------------------------
  router.get('/reminders', (req, res) => {
    const reminder = store.data.reminders.find((r) => r.userId === req.user!.id) ?? null;
    res.json({ reminder });
  });

  router.put('/reminders', (req, res) => {
    try {
      const body = z
        .object({
          channel: z.enum(['sms', 'whatsapp', 'in_app']),
          weeklyDay: z.number().int().min(0).max(6),
          hour: z.number().int().min(0).max(23),
          quietStart: z.string().regex(/^\d{2}:\d{2}$/),
          quietEnd: z.string().regex(/^\d{2}:\d{2}$/),
          active: z.boolean(),
        })
        .parse(req.body);
      let reminder = store.data.reminders.find((r) => r.userId === req.user!.id);
      if (!reminder) {
        reminder = { userId: req.user!.id, ...body, updatedAt: new Date().toISOString() };
        store.data.reminders.push(reminder);
      } else {
        Object.assign(reminder, body, { updatedAt: new Date().toISOString() });
      }
      store.save();
      res.json({ reminder });
    } catch (error) {
      if (!handleZod(res, error)) fail(res, 500, 'ERROR', 'Could not save the reminder.');
    }
  });

  router.post('/reminders/test', async (req, res) => {
    try {
      const reminder = store.data.reminders.find((r) => r.userId === req.user!.id);
      if (!reminder) {
        fail(res, 400, 'NO_REMINDER', 'Set a reminder first.');
        return;
      }
      const message = `This is a test reminder from ${env.appName}. Keep learning, small small.`;
      const phone = reachablePhone(req.user!, env);
      if (!phone) {
        fail(res, 400, 'NO_PHONE', 'This account has no phone number for reminders.');
        return;
      }
      if (reminder.channel === 'whatsapp') {
        await getWhatsAppProvider(env).send(phone, message);
      } else {
        await getSmsProvider(env).send(phone, message);
      }
      store.audit(req.user!.id, 'reminder_test', 'reminder', null, { channel: reminder.channel });
      res.json({ ok: true });
    } catch {
      fail(res, 500, 'ERROR', 'Could not send the test reminder.');
    }
  });

  return router;
}
