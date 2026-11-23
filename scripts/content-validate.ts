/**
 * Structural validation of everything in content/.
 *
 *   npm run content:validate
 *
 * Exits 1 on a real problem (broken references, missing fields, malformed
 * fixtures). Translation coverage gaps are reported as warnings: the app is
 * designed to fall back to English and show a notice while a language is still
 * being reviewed.
 */
import { LANGS, PRACTICE_APPS, loadContent, type Lang } from './lib/content';

const errors: string[] = [];
const warnings: string[] = [];

const content = loadContent();

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

// ---- paths -----------------------------------------------------------------
const pathSlugs = content.paths.map((entry) => entry.slug);
for (const slug of duplicates(pathSlugs)) errors.push(`Duplicate path slug: ${slug}`);
for (const entry of content.paths) {
  if (!entry.slug || !entry.titleKey || !entry.title) errors.push(`Path ${entry.slug || '(no slug)'} is missing a slug, titleKey or title`);
  if (!Number.isInteger(entry.order)) errors.push(`Path ${entry.slug} has a non-integer order`);
  if (!Array.isArray(entry.lessons) || entry.lessons.length === 0) errors.push(`Path ${entry.slug} has no lessons`);
}

// ---- lessons ---------------------------------------------------------------
const lessonSlugs = content.lessons.map((entry) => entry.slug);
for (const slug of duplicates(lessonSlugs)) errors.push(`Duplicate lesson slug: ${slug}`);

for (const lesson of content.lessons) {
  const where = `Lesson ${lesson.slug || '(no slug)'}`;
  if (!lesson.slug) errors.push(`${where} has no slug`);
  if (!lesson.title || !lesson.titleKey) errors.push(`${where} is missing a title or titleKey`);
  if (!lesson.selfCheck || !lesson.selfCheckKey) errors.push(`${where} is missing a self check`);
  if (!pathSlugs.includes(lesson.path)) errors.push(`${where} points at unknown path "${lesson.path}"`);
  if (!Number.isInteger(lesson.minutes) || lesson.minutes <= 0) errors.push(`${where} has an invalid duration`);
  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
    errors.push(`${where} has no steps`);
    continue;
  }
  const stepIds = lesson.steps.map((step) => step.id);
  for (const id of duplicates(stepIds)) errors.push(`${where} has a duplicate step id "${id}"`);
  lesson.steps.forEach((step, index) => {
    const at = `${where} step ${index + 1}`;
    if (!step.id) errors.push(`${at} has no id`);
    if (!step.textKey) errors.push(`${at} has no textKey`);
    if (!step.text) errors.push(`${at} has no text`);
    if (!step.alt) errors.push(`${at} has no alt text for screen readers`);
    if (!step.visual) errors.push(`${at} has no visual name`);
    if (step.spotlight) {
      const { shape, x, y, w, h } = step.spotlight;
      if (!['circle', 'rect'].includes(shape)) errors.push(`${at} has an invalid spotlight shape`);
      for (const [name, value] of Object.entries({ x, y, w, h })) {
        if (typeof value !== 'number' || value < 0 || value > 100) errors.push(`${at} spotlight ${name} must be 0-100`);
      }
    }
    if (step.practice) {
      if (!PRACTICE_APPS.includes(step.practice.app)) errors.push(`${at} uses unknown practice app "${step.practice.app}"`);
      if (!step.practice.target) errors.push(`${at} practice has no target`);
      if (!step.practice.instruction || !step.practice.instructionKey) errors.push(`${at} practice has no instruction`);
    }
  });
  const owned = content.paths.find((entry) => entry.slug === lesson.path);
  if (owned && !owned.lessons.includes(lesson.slug)) {
    errors.push(`Lesson ${lesson.slug} is not listed in its own path ${owned.slug}`);
  }
}

for (const entry of content.paths) {
  for (const slug of entry.lessons) {
    if (!lessonSlugs.includes(slug)) errors.push(`Path ${entry.slug} lists unknown lesson "${slug}"`);
  }
}

// ---- strings ---------------------------------------------------------------
const enKeys = Object.keys(content.strings.en);
if (enKeys.length === 0) errors.push('strings/en.json is empty');
for (const key of enKeys) {
  if (!content.strings.en[key]?.trim()) errors.push(`English string "${key}" is empty`);
}
for (const lang of LANGS) {
  const dict = content.strings[lang];
  if (!dict || Object.keys(dict).length === 0) errors.push(`strings/${lang}.json is missing or empty`);
}
for (const lang of LANGS.filter((code): code is Exclude<Lang, 'en'> => code !== 'en')) {
  const missing = enKeys.filter((key) => !content.strings[lang][key]);
  if (missing.length) {
    warnings.push(
      `${lang}: ${missing.length} of ${enKeys.length} UI strings are not translated yet (English fallback is shown with a notice)`,
    );
  }
  const english = enKeys.filter((key) => content.strings[lang][key] === content.strings.en[key]);
  if (english.length) warnings.push(`${lang}: ${english.length} strings are identical to English and may be untranslated`);
}

// ---- scam examples and glossary -------------------------------------------
const exampleIds = content.scamExamples.map((entry) => entry.id);
for (const id of duplicates(exampleIds)) errors.push(`Duplicate scam example id: ${id}`);
for (const example of content.scamExamples) {
  if (!LANGS.includes(example.lang as never)) errors.push(`Scam example ${example.id} has unknown language "${example.lang}"`);
  if (!example.text?.trim()) errors.push(`Scam example ${example.id} has no text`);
  if (typeof example.isScam !== 'boolean') errors.push(`Scam example ${example.id} must set isScam`);
}

const glossaryIds = content.glossary.map((entry) => entry.id);
for (const id of duplicates(glossaryIds)) errors.push(`Duplicate glossary id: ${id}`);
for (const entry of content.glossary) {
  if (!entry.term?.trim() || !entry.explanation?.trim()) errors.push(`Glossary ${entry.id} is missing a term or explanation`);
}

// ---- evaluation fixtures ---------------------------------------------------
const evalIds = content.scamEval.map((row) => row.id);
for (const id of duplicates(evalIds)) errors.push(`Duplicate scam eval id: ${id}`);
for (const row of content.scamEval) {
  if (!['scam', 'unsure', 'safe'].includes(row.expected)) errors.push(`Scam eval ${row.id} has an invalid expectation`);
  if (!row.text?.trim()) errors.push(`Scam eval ${row.id} has no text`);
}

const safetyIds = content.assistantSafety.map((row) => row.id);
for (const id of duplicates(safetyIds)) errors.push(`Duplicate assistant safety id: ${id}`);
for (const row of content.assistantSafety) {
  if (!['sensitive_block', 'crisis', 'ai', 'no_advice', 'normal'].includes(row.expect)) {
    errors.push(`Assistant safety ${row.id} has an invalid expectation`);
  }
  if (!row.prompt?.trim()) errors.push(`Assistant safety ${row.id} has no prompt`);
}

// ---- report ----------------------------------------------------------------
const steps = content.lessons.reduce((sum, lesson) => sum + lesson.steps.length, 0);
console.log(
  `Content: ${content.paths.length} paths · ${content.lessons.length} lessons · ${steps} steps · ` +
    `${enKeys.length} English strings · ${content.scamExamples.length} scam examples · ${content.glossary.length} glossary terms`,
);

if (warnings.length) {
  console.log('\nWarnings');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s) found`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log('\n✓ Content is valid.');
