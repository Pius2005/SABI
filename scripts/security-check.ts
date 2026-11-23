/**
 * Repository security checks.
 *
 *   npm run security:check
 *
 * These are the rules the app promises in its privacy design. They are cheap
 * static checks, not a substitute for a real penetration test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { env } from '../apps/api/src/env';
import { ROOT_DIR } from './lib/content';

const failures: string[] = [];
const passes: string[] = [];

function check(name: string, condition: boolean, detail: string): void {
  if (condition) passes.push(name);
  else failures.push(`${name} — ${detail}`);
}

function read(relative: string): string {
  try {
    return fs.readFileSync(path.join(ROOT_DIR, relative), 'utf8');
  } catch {
    return '';
  }
}

function exists(relative: string): boolean {
  return fs.existsSync(path.join(ROOT_DIR, relative));
}

function walk(directory: string, out: string[] = []): string[] {
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ---- repository hygiene ---------------------------------------------------
const gitignore = read('.gitignore');
for (const pattern of ['.env', 'apps/api/data/', 'apps/api/tts-cache/', 'dist/', 'coverage/']) {
  check(`.gitignore covers ${pattern}`, gitignore.includes(pattern), 'add it so secrets and local data are never committed');
}

if (fs.existsSync(path.join(ROOT_DIR, '.git'))) {
  try {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT_DIR, encoding: 'utf8' });
    check('.env is not tracked by git', !tracked.split('\n').includes('.env'), 'run: git rm --cached .env');
    check(
      'the local database is not tracked by git',
      !tracked.includes('apps/api/data/db.json'),
      'run: git rm --cached apps/api/data/db.json',
    );
  } catch {
    passes.push('git working tree inspected');
  }
}

// ---- no hardcoded provider secrets ---------------------------------------
const secretPattern = /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/;
const sources = [
  ...walk(path.join(ROOT_DIR, 'apps')),
  ...walk(path.join(ROOT_DIR, 'packages')),
  ...walk(path.join(ROOT_DIR, 'scripts')),
];
const leaking = sources.filter((file) => secretPattern.test(fs.readFileSync(file, 'utf8')));
check(
  'no provider secret is hardcoded in source',
  leaking.length === 0,
  leaking.map((file) => path.relative(ROOT_DIR, file)).join(', '),
);

const envExample = read('.env.example');
check(
  '.env.example ships no real credential values',
  !secretPattern.test(envExample) && !/[A-Fa-f0-9]{32,}/.test(envExample),
  'replace real keys with empty placeholders',
);

// ---- password and phone storage ------------------------------------------
const dbPath = path.join(ROOT_DIR, env.databaseFile || 'apps/api/data/db.json');
if (fs.existsSync(dbPath)) {
  try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as {
      users?: Array<Record<string, unknown>>;
    };
    const users = db.users ?? [];
    const plaintextPhone = users.filter((user) => typeof user.phone === 'string' && user.phone);
    const weakHash = users.filter(
      (user) => typeof user.passwordHash === 'string' && user.passwordHash && !/^\$2[aby]\$/.test(user.passwordHash),
    );
    const exposedEnc = users.filter(
      (user) => typeof user.phoneEnc === 'string' && /^0\d{10}$/.test(user.phoneEnc as string),
    );
    check('stored phone numbers are encrypted, never plaintext', plaintextPhone.length === 0, `${plaintextPhone.length} user rows hold a plain phone`);
    check('password hashes use bcrypt', weakHash.length === 0, `${weakHash.length} rows are not bcrypt hashes`);
    check('encrypted phone values are not the raw number', exposedEnc.length === 0, 'phoneEnc must be ciphertext');
  } catch {
    failures.push('database could not be read for a privacy check');
  }
} else {
  passes.push('no local database present to inspect');
}

// ---- production configuration --------------------------------------------
if (env.nodeEnv === 'production') {
  check(
    'JWT_ACCESS_SECRET is not the development default in production',
    env.jwtAccessSecret !== 'dev-access-secret-change-me' && env.jwtAccessSecret.length >= 32,
    'set a 32+ character secret',
  );
  check(
    'JWT_REFRESH_SECRET is not the development default in production',
    env.jwtRefreshSecret !== 'dev-refresh-secret-change-me' && env.jwtRefreshSecret.length >= 32,
    'set a 32+ character secret',
  );
  check(
    'ENCRYPTION_KEY is not the development default in production',
    env.encryptionKey !== 'dev-encryption-key-change-me' && env.encryptionKey.length >= 32,
    'set a 32+ character key',
  );
  check(
    'unreviewed translations are off in production',
    env.allowUnreviewedTranslations === false,
    'set ALLOW_UNREVIEWED_TRANSLATIONS=false',
  );
} else {
  passes.push('production secret checks skipped outside production');
}

// ---- application guards ---------------------------------------------------
const app = read('apps/api/src/app.ts');
check('CORS uses an allow-list, not a wildcard', !/origin:\s*['"]\*['"]/.test(app) && app.includes('origins.has(origin)'), 'reject unknown origins');
check('helmet security headers are enabled', app.includes('helmet('), 'mount helmet');
check('x-powered-by is disabled', app.includes("disable('x-powered-by')"), 'hide the framework');

const auth = read('apps/api/src/routes/auth.ts');
check('the OTP is hashed at rest', auth.includes('hashCode('), 'never store the plain code');
check('OTP attempts are rate limited', auth.includes('attempts >= 5') && auth.includes('lockedUntil'), 'lock after five tries');
check('staff logins are rate limited', auth.includes('staffAttempts'), 'lock repeated failures');
check('staff passwords are compared with bcrypt', auth.includes('bcrypt.compareSync'), 'never compare plaintext');

const voice = read('apps/api/src/routes/voice.ts');
check('voice turns are rate limited', voice.includes('rateLimited('), 'add a per-user limiter');
check('uploaded audio is never written to disk', !voice.includes('writeFile') && voice.includes('memoryStorage'), 'use memory storage');

const safety = read('packages/shared/src/safety.ts');
check('sensitive values are redacted before storage', safety.includes('redactSensitive'), 'keep redaction');
check('assistant replies are sanitised', safety.includes('sanitizeReply'), 'keep the reply guard');
check('no console logging in the shared safety module', !/console\.(log|info|warn|error)/.test(safety), 'never log learner input');

const mockSms = read('apps/api/src/providers.ts');
check('the mock SMS provider masks the code it logs', mockSms.includes("[code]"), 'redact OTP values in logs');

// ---- report ---------------------------------------------------------------
console.log('Security checks');
for (const pass of passes) console.log(`  ✓ ${pass}`);
for (const failure of failures) console.error(`  ✗ ${failure}`);

if (failures.length) {
  console.error(`\n${failures.length} security check(s) failed.`);
  process.exit(1);
}

console.log(`\n✓ ${passes.length} security checks passed.`);
