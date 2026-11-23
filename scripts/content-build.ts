/**
 * Rebuild the content tables of the local JSON database from content/ without
 * touching learner accounts, progress or audit history.
 *
 *   npm run content:build
 */
import { env } from '../apps/api/src/env';
import { Store } from '../apps/api/src/store';
import { seedDatabase } from '../apps/api/src/seed';

const store = Store.open({ env, file: env.databaseFile || null });
const fresh = seedDatabase(env);

store.data.paths = fresh.paths;
store.data.lessons = fresh.lessons;
store.data.translations = fresh.translations;
store.data.scamExamples = fresh.scamExamples;
store.data.glossary = fresh.glossary;
store.data.seededAt = fresh.seededAt;
store.saveNow();

console.log(
  `Rebuilt content: ${store.data.paths.length} paths, ${store.data.lessons.length} lessons, ` +
    `${store.data.translations.length} translations, ${store.data.scamExamples.length} scam examples, ` +
    `${store.data.glossary.length} glossary terms.`,
);
console.log(`Learner data kept: ${store.data.users.length} users, ${store.data.progress.length} progress rows.`);
console.log(`Database: ${store.file ?? '(memory)'}`);
