import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { readFeature, type FeatureExample } from './feature.js';
import { freshCustomer, HelperPage } from './helper-page.js';
import { writeEntries, type ManifestEntry } from './manifest.js';
import { answerCheck } from './thens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featurePath = path.join(__dirname, 'helper.feature');

function answerExamples(examples: FeatureExample[]): FeatureExample[] {
  return examples.filter((example) => example.thens.some((then) => answerCheck(then)));
}

const examples = answerExamples(readFeature(featurePath));

for (const example of examples) {
  const phrase = example.row.phrase;
  if (!phrase) continue;

  const title = `Tier C: ${phrase}`;
  const answerThens = example.thens.filter((then) => answerCheck(then));

  test(title, { tag: '@helper' }, async ({ page, request }) => {
    test.setTimeout(120_000);

    await freshCustomer(page, request);
    const helper = new HelperPage(page);
    await helper.open();
    await helper.ask(phrase);
    const reply = await helper.lastHelperReply();

    const entries: ManifestEntry[] = [];
    const failed: string[] = [];

    for (const then of example.thens) {
      const check = answerCheck(then);
      if (!check) {
        entries.push({
          tier: 'c',
          scenario: example.scenario,
          example: example.when,
          then,
          result: 'judge',
          evidence: 'needs human/agent judge (no automated answer check)',
        });
        continue;
      }

      let outcome: { pass: boolean; evidence: string };
      try {
        outcome = await check({ page, helper, request, reply, row: example.row });
      } catch (error) {
        outcome = {
          pass: false,
          evidence: error instanceof Error ? error.message : String(error),
        };
      }
      entries.push({
        tier: 'c',
        scenario: example.scenario,
        example: example.when,
        then,
        result: outcome.pass ? 'pass' : 'fail',
        evidence: outcome.evidence,
      });
      if (!outcome.pass) failed.push(then);
    }

    // Ensure answer Thens were the ones we intended to score.
    for (const then of answerThens) {
      if (!entries.some((e) => e.then === then && e.result !== 'judge')) {
        failed.push(then);
      }
    }

    writeEntries('c', title, entries);

    if (failed.length > 0) {
      throw new Error(`Failed Thens:\n${failed.map((t) => `- ${t}`).join('\n')}`);
    }
  });
}
