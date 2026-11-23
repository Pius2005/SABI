import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import type { DbData } from './db-types';
import { emptyDb } from './db-types';
import type { Env } from './env';
import { seedDatabase } from './seed';

const DEFAULT_FILE = path.resolve(fileURLToPath(new URL('../data/db.json', import.meta.url)));

export class Store {
  data: DbData;
  file: string | null;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(data: DbData, file: string | null) {
    this.data = data;
    this.file = file;
  }

  static open(opts: { file?: string | null; env: Env; memory?: boolean }): Store {
    if (opts.memory) {
      return new Store(seedDatabase(opts.env), null);
    }
    const file = opts.file || DEFAULT_FILE;
    if (fs.existsSync(file)) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as DbData;
        if (raw.version === 1 && Array.isArray(raw.users)) return new Store(raw, file);
      } catch {
        // fall through to a fresh seed
      }
    }
    const store = new Store(seedDatabase(opts.env), file);
    store.saveNow();
    return store;
  }

  save(): void {
    if (!this.file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 30);
  }

  saveNow(): void {
    if (!this.file) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  reset(env: Env): void {
    this.data = seedDatabase(env);
    this.saveNow();
  }

  audit(actorId: string | null, action: string, entity: string, entityId: string | null, meta: Record<string, unknown> | null = null): void {
    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      actorId,
      action,
      entity,
      entityId,
      meta,
      createdAt: new Date().toISOString(),
    });
    if (this.data.auditLogs.length > 2000) this.data.auditLogs.length = 2000;
    this.save();
  }

  userById(id: string) {
    return this.data.users.find((u) => u.id === id && !u.deletedAt) ?? null;
  }

  userByPhoneHash(hash: string) {
    return this.data.users.find((u) => u.phoneHash === hash && !u.deletedAt) ?? null;
  }

  userByEmail(email: string) {
    return this.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase() && !u.deletedAt) ?? null;
  }

  lesson(slug: string) {
    return this.data.lessons.find((l) => l.slug === slug) ?? null;
  }

  path(slug: string) {
    return this.data.paths.find((p) => p.slug === slug) ?? null;
  }

  translation(key: string, lang: string) {
    return this.data.translations.find((t) => t.key === key && t.lang === lang) ?? null;
  }

  progressFor(userId: string) {
    return this.data.progress.filter((p) => p.userId === userId);
  }

  progress(userId: string, lessonSlug: string) {
    return this.data.progress.find((p) => p.userId === userId && p.lessonSlug === lessonSlug) ?? null;
  }

  consentsFor(userId: string) {
    return this.data.consents.filter((c) => c.userId === userId);
  }

  activeConsent(userId: string, type: string): boolean {
    const rows = this.data.consents
      .filter((c) => c.userId === userId && c.type === type)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return rows.length > 0 ? rows[rows.length - 1].granted : false;
  }

  activeFamilyLinks(learnerId: string) {
    return this.data.familyLinks.filter((l) => l.learnerId === learnerId && !l.revokedAt && l.status === 'active');
  }

  groupsForFacilitator(facilitatorId: string) {
    return this.data.groups.filter((g) => g.facilitatorId === facilitatorId);
  }

  memberIds(groupId: string) {
    return this.data.groupMembers.filter((m) => m.groupId === groupId).map((m) => m.userId);
  }

  learnerIdsForStaff(userId: string, role: string): string[] {
    if (role === 'ADMIN') return this.data.users.filter((u) => u.role === 'LEARNER' && !u.deletedAt).map((u) => u.id);
    const groups = this.groupsForFacilitator(userId);
    return [...new Set(groups.flatMap((g) => this.memberIds(g.id)))];
  }
}

export function freshStore(env: Env): Store {
  return new Store(emptyDb(), null);
}
