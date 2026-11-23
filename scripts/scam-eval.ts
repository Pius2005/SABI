/**
 * Evaluate the rule-based scam detector against content/scam-eval.json.
 *
 *   npm run scam:eval
 *
 * The run fails on a safety-critical mistake: any message the fixtures call a
 * scam that the detector calls "safe", or any message that asks for a
 * credential that the detector calls "safe".
 */
import { analyzeMessage, analyzeSensitive } from '../packages/shared/src';
import { loadContent, pad } from './lib/content';

const rows = loadContent().scamEval;

const results = rows.map((row) => {
  const analysis = analyzeMessage(row.text);
  return {
    ...row,
    verdict: analysis.verdict,
    score: analysis.score,
    confidence: analysis.confidence,
    rules: analysis.redFlags,
    pass: analysis.verdict === row.expected,
    asksForCredential: analyzeSensitive(row.text).isRequest,
  };
});

const passed = results.filter((row) => row.pass).length;
const accuracy = passed / results.length;

console.log('Scam detector evaluation');
console.log(`${pad('id', 6)}${pad('expected', 10)}${pad('verdict', 10)}${pad('score', 6)}critical`);
for (const row of results) {
  console.log(
    `${pad(row.id, 6)}${pad(row.expected, 10)}${pad(row.verdict, 10)}${pad(row.score, 6)}${
      row.pass ? 'ok' : `MISS (${row.rules.join(', ') || 'no rule matched'})`
    }`,
  );
}

const dangerous = results.filter(
  (row) => (row.expected === 'scam' && row.verdict === 'safe') || (row.asksForCredential && row.verdict === 'safe'),
);

console.log(`\nAccuracy ${passed}/${results.length} (${(accuracy * 100).toFixed(1)}%)`);

if (dangerous.length) {
  console.error('\nSafety failures: a scam or credential request was called safe');
  for (const row of dangerous) console.error(`  ✗ ${row.id}: ${row.text}`);
  process.exit(1);
}

if (accuracy < 0.9) {
  console.error(`\nAccuracy ${(accuracy * 100).toFixed(1)}% is below the 90% floor.`);
  process.exit(1);
}

console.log('✓ No scam or credential request was called safe.');
