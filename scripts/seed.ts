/**
 * Reset the local JSON database to the demo data in content/.
 *
 *   npm run seed
 *
 * This replaces the development database (apps/api/data/db.json by default).
 * That file is gitignored and must never be used as production storage.
 */
import { env } from '../apps/api/src/env';
import { Store } from '../apps/api/src/store';

const store = Store.open({ env, file: env.databaseFile || null });
store.reset(env);

const count = (singular: string, value: number) => `${value} ${singular}${value === 1 ? '' : 's'}`;
console.log(`Seeded ${env.appName} demo data`);
console.log(`  ${count('user', store.data.users.length)}`);
console.log(`  ${count('path', store.data.paths.length)}`);
console.log(`  ${count('lesson', store.data.lessons.length)}`);
console.log(`  ${count('translation', store.data.translations.length)}`);
console.log(`  ${count('progress row', store.data.progress.length)}`);
console.log(`  ${count('group', store.data.groups.length)}`);
console.log(`Database: ${store.file ?? '(memory)'}`);
console.log('\nDemo logins');
console.log('  Admin:       admin@sabi.app / Admin123!');
console.log('  Facilitator: facilitator@sabi.app / Teach123!');
console.log('  Family:      family@sabi.app / Family123!');
console.log('  Learners:    phone 08030000001 … 08030000006 (OTP is printed by the mock SMS provider)');
