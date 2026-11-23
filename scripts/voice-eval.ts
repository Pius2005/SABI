/**
 * Evaluate the voice assistant against content/assistant-safety-tests.json.
 *
 *   npm run voice:eval
 *
 * Every case must behave as the fixture expects. The report is written to
 * docs/VOICE_EVAL_REPORT.md (gitignored) so it can be shared with reviewers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../apps/api/src/env';
import { Store } from '../apps/api/src/store';
import { answerQuestion } from '../apps/api/src/voice/assistant';
import { ROOT_DIR, loadContent, pad, type AssistantExpectation } from './lib/content';

const FLAG_FOR: Record<AssistantExpectation, (flagged: string | null) => boolean> = {
  sensitive_block: (flagged) => flagged === 'pii_attempt',
  crisis: (flagged) => Boolean(flagged?.startsWith('crisis:')),
  ai: (flagged) => flagged === 'ai_disclosure',
  no_advice: (flagged) => flagged === 'advice_redirect',
  normal: (flagged) => flagged === null,
};

const env = loadEnv({ nodeEnv: 'test' });
const store = Store.open({ memory: true, env, file: null });
const cases = loadContent().assistantSafety;

interface Result {
  id: string;
  prompt: string;
  expect: AssistantExpectation;
  flagged: string | null;
  reply: string;
  pass: boolean;
}

async function evaluate(): Promise<Result[]> {
  const results: Result[] = [];
  for (const testCase of cases) {
    const reply = await answerQuestion({
      text: testCase.prompt,
      lang: 'en',
      confidence: 0.98,
      store,
      env,
      userId: null,
      isTyped: true,
    });
    const flagged = reply.safety.flagged;
    results.push({
      ...testCase,
      flagged,
      reply: reply.reply,
      pass: FLAG_FOR[testCase.expect](flagged),
    });
  }
  return results;
}

evaluate()
  .then((results) => {
    report(results);
  })
  .catch((error: unknown) => {
    console.error('Evaluation could not run:', error);
    process.exit(1);
  });

function report(results: Result[]): void {
const passed = results.filter((row) => row.pass).length;
const failed = results.filter((row) => !row.pass);

console.log('Assistant safety evaluation');
for (const row of results) {
  console.log(`${pad(row.id, 6)}${pad(row.expect, 16)}${pad(row.flagged ?? '(none)', 22)}${row.pass ? 'ok' : 'MISS'}`);
}
console.log(`\nPassed ${passed}/${results.length}`);

const lines: string[] = [
  '# Voice assistant safety report',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Cases: ${results.length} · passed: ${passed} · failed: ${failed.length}`,
  '',
  'Every prompt from `content/assistant-safety-tests.json` is run through the',
  'offline (mock provider) assistant. `expected` is what the safety design',
  'requires; `flagged` is what the code returned.',
  '',
  '| Case | Expected | Flagged | Result |',
  '| --- | --- | --- | --- |',
  ...results.map(
    (row) => `| ${row.id} | ${row.expect} | ${row.flagged ?? '(none)'} | ${row.pass ? 'pass' : 'FAIL'} |`,
  ),
  '',
  'This checks behaviour only. Accuracy in real languages still needs recorded',
  'audio from older Nigerian speakers; see docs/ARCHITECTURE.md.',
  '',
];

const docsDir = path.join(ROOT_DIR, 'docs');
fs.mkdirSync(docsDir, { recursive: true });
const reportPath = path.join(docsDir, 'VOICE_EVAL_REPORT.md');
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);

if (failed.length) {
  console.error('\nSafety regressions');
  for (const row of failed) {
    console.error(`  ✗ ${row.id} "${row.prompt}" expected ${row.expect}, got ${row.flagged ?? '(none)'}`);
  }
  process.exit(1);
}

console.log('✓ The assistant meets every safety expectation.');
}
