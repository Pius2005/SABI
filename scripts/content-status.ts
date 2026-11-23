/**
 * Translation and content coverage report.
 *
 *   npm run content:status
 */
import { LANGS, loadContent, pad } from './lib/content';

const content = loadContent();
const enKeys = Object.keys(content.strings.en);

console.log('UI string coverage');
console.log(`${pad('lang', 6)}${pad('translated', 12)}${pad('missing', 9)}${pad('unchanged', 11)}coverage`);
for (const lang of LANGS) {
  const dict = content.strings[lang] ?? {};
  const translated = enKeys.filter((key) => dict[key]).length;
  const missing = enKeys.length - translated;
  const unchanged = enKeys.filter((key) => dict[key] && dict[key] === content.strings.en[key]).length;
  const coverage = ((translated / enKeys.length) * 100).toFixed(1);
  console.log(`${pad(lang, 6)}${pad(translated, 12)}${pad(missing, 9)}${pad(unchanged, 11)}${coverage}%`);
}

console.log('\nLesson content');
console.log(`${pad('lang', 6)}${pad('lesson titles', 15)}${pad('step texts', 12)}coverage`);
const stepCount = content.lessons.reduce((sum, lesson) => sum + lesson.steps.length, 0);
for (const lang of LANGS) {
  const titles = content.lessons.filter((lesson) => lang === 'en' || lesson.titleTexts?.[lang]).length;
  const texts =
    lang === 'en'
      ? stepCount
      : content.lessons.reduce(
          (sum, lesson) => sum + lesson.steps.filter((step) => step.texts?.[lang]).length,
          0,
        );
  const percent = ((texts / stepCount) * 100).toFixed(1);
  console.log(`${pad(lang, 6)}${pad(`${titles}/${content.lessons.length}`, 15)}${pad(`${texts}/${stepCount}`, 12)}${percent}%`);
}

const needsAudio = content.lessons.reduce(
  (sum, lesson) => sum + lesson.steps.filter((step) => !step.alt).length,
  0,
);
console.log(`\nSteps without alt text: ${needsAudio}`);
console.log(
  `Scam examples: ${content.scamExamples.length} · glossary: ${content.glossary.length} · ` +
    `scam eval cases: ${content.scamEval.length} · assistant safety cases: ${content.assistantSafety.length}`,
);
