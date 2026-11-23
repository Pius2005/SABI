import { env } from './env';
import { Store } from './store';
import { createApp } from './app';

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
