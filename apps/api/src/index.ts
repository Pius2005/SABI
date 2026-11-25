import { env } from './env';
import { Store } from './store';
import { createApp } from './app';

// Refuse to serve real learners with development secrets. `npm run
// security:check` catches this before a release, but a container can start
// without that step, so fail closed here too.
if (env.nodeEnv === 'production') {
  const unsafe = [
    ['JWT_ACCESS_SECRET', env.jwtAccessSecret, 'dev-access-secret-change-me'],
    ['JWT_REFRESH_SECRET', env.jwtRefreshSecret, 'dev-refresh-secret-change-me'],
    ['ENCRYPTION_KEY', env.encryptionKey, 'dev-encryption-key-change-me'],
  ].filter(([, value, devDefault]) => value === devDefault || value.length < 32);
  if (unsafe.length) {
    console.error(
      `[api] refusing to start: set 32+ character values for ${unsafe.map(([name]) => name).join(', ')}`,
    );
    process.exit(1);
  }
  if (!env.adminEmail && !env.adminPassword) {
    console.warn('[api] ADMIN_EMAIL/ADMIN_PASSWORD are unset: this database has no administrator until you seed one.');
  }
  if (env.smsProvider !== 'termii' || !env.smsApiKey) {
    console.warn(
      '[api] SMS is not configured: set SMS_PROVIDER=termii and SMS_API_KEY, or learners cannot receive login codes.',
    );
  }
}

// Open the JSON store (seeds on first run) and mount the API.
const store = Store.open({ env, file: env.databaseFile || null });
const app = createApp({ store, env });

const server = app.listen(env.port, () => {
  console.log(`\n${env.appName} API listening on http://localhost:${env.port}`);
  console.log(`Health: http://localhost:${env.port}/api/v1/health`);
  if (env.nodeEnv !== 'production') {
    console.log('\nDemo logins');
    console.log('  Admin:       admin@sabi.app / Admin123!');
    console.log('  Facilitator: facilitator@sabi.app / Teach123!');
    console.log('  Family:      family@sabi.app / Family123!');
    console.log('  Learners:    phone 08030000001 … 08030000006 (OTP is printed here and shown in the app)');
    console.log(`  SMS provider: ${env.smsProvider} · LLM: ${env.llmProvider}\n`);
  }
});

function shutdown(signal: string) {
  console.log(`\n[api] ${signal} received, saving data…`);
  store.saveNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
