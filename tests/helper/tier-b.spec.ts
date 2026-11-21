import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { readFeature, type FeatureExample } from './feature.js';
import { freshCustomer, HelperPage, type RecordedCall } from './helper-page.js';
import { writeEntries, type ManifestEntry } from './manifest.js';
import { expectedCall, runCheck, sortUiThens, uiCheck, type ExpectedCall } from './thens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featurePath = path.join(__dirname, 'helper.feature');

const parsedRuns = Number(process.env.HELPER_RUNS);
const RUNS = Number.isInteger(parsedRuns) && parsedRuns > 0 ? parsedRuns : 10;

function meetsBar(passes: number): boolean {
  return passes * 10 >= RUNS * 9;
}

function argsMatch(expected: ExpectedCall, actual: RecordedCall | null): boolean {
  if (!actual || actual.name !== expected.name) return false;
  return Object.entries(expected.args).every(([key, value]) => {
    const got = actual.args[key];
    if (Object.is(got, value)) return true;
    if (typeof value === 'number' && typeof got === 'string' && Number(got) === value) return true;
    return JSON.stringify(got) === JSON.stringify(value);
  });
}

function describeCall(call: RecordedCall | null): string {
  if (!call) return 'none';
  return JSON.stringify({ name: call.name, args: call.args });
}

function toolExamples(examples: FeatureExample[]): FeatureExample[] {
  return examples.filter((example) => example.thens.some((then) => expectedCall(then)));
}

const examples = toolExamples(readFeature(featurePath));

for (const example of examples) {
  const phrase = example.row.phrase;
  const callThen = example.thens.find((then) => expectedCall(then));
  if (!phrase || !callThen) continue;
  const expected = expectedCall(callThen);
  if (!expected) continue;

  const title = `Tier B: ${phrase}`;

  test(title, { tag: '@helper' }, async ({ page, request }) => {
    test.setTimeout(RUNS * 15_000);

    const helper = new HelperPage(page);
    const uiThens = sortUiThens(example.thens.filter((then) => then !== callThen && uiCheck(then)));
    const passes = new Map<string, number>([[callThen, 0], ...uiThens.map((then) => [then, 0] as const)]);
    const evidence = new Map<string, string>();
    const seenCalls: string[] = [];

    for (let run = 0; run < RUNS; run += 1) {
      try {
        await freshCustomer(page, request);
        await helper.open();
        await helper.ask(phrase);

        const actual = await helper.lastModelCall();
        seenCalls.push(describeCall(actual));
        if (argsMatch(expected, actual)) passes.set(callThen, (passes.get(callThen) ?? 0) + 1);

        const ctx = { page, helper };
        for (const then of uiThens) {
          const outcome = await runCheck(uiCheck(then), ctx);
          if (outcome.pass) passes.set(then, (passes.get(then) ?? 0) + 1);
          if (!outcome.pass || !evidence.has(then)) evidence.set(then, outcome.evidence);
        }
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).replace(/\u001b\[[0-9;]*m/g, '');
        seenCalls.push(`error: ${message}`);
        for (const then of uiThens) {
          if (!evidence.has(then)) evidence.set(then, message);
        }
      }
    }

    const distinctCalls = [...new Set(seenCalls)].join(' | ');
    const entries: ManifestEntry[] = example.thens.map((then) => {
      if (then !== callThen && !uiThens.includes(then)) {
        return {
          tier: 'b',
          scenario: example.scenario,
          example: example.when,
          then,
          result: 'judge',
          evidence: 'needs judge (no automated check at this tier)',
        };
      }
      const count = passes.get(then) ?? 0;
      return {
        tier: 'b',
        scenario: example.scenario,
        example: example.when,
        then,
        result: meetsBar(count) ? 'pass' : 'fail',
        passRate: `${count}/${RUNS}`,
        evidence: then === callThen ? distinctCalls : evidence.get(then),
      };
    });

    writeEntries('b', title, entries);

    const below = entries.filter((entry) => entry.result === 'fail');
    if (below.length > 0) {
      throw new Error(
        `Thens below 9/10:\n${below.map((entry) => `- ${entry.then} (${entry.passRate})`).join('\n')}`,
      );
    }
  });
}
