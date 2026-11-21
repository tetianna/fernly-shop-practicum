import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { readFeature } from './feature.js';
import { freshCustomer, type ToolName, HelperPage } from './helper-page.js';
import { writeEntries, type ManifestEntry } from './manifest.js';
import { callKey, expectedCall, runCheck, sortUiThens, uiCheck, type ExpectedCall } from './thens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featurePath = path.join(__dirname, 'helper.feature');

interface ToolGroup {
  call: ExpectedCall;
  examples: ReturnType<typeof readFeature>;
}

function groupByToolCall(examples: ReturnType<typeof readFeature>): ToolGroup[] {
  const map = new Map<string, ToolGroup>();
  for (const example of examples) {
    const callThen = example.thens.find((t) => t.startsWith('the helper calls '));
    if (!callThen) continue;
    const call = expectedCall(callThen);
    if (!call) continue;
    const key = callKey(call);
    const group = map.get(key) ?? { call, examples: [] };
    group.examples.push(example);
    map.set(key, group);
  }
  return [...map.values()];
}

function testTitleFor(call: ExpectedCall): string {
  const { name, args } = call;
  if (name === 'search_plants') return `search_plants-${JSON.stringify(args)}`;
  if (name === 'open_plant') return `open_plant-${String(args.plantId)}`;
  if (name === 'add_to_cart') {
    return `add_to_cart-${String(args.plantId)}-${String(args.size)}-qty${String(args.quantity)}`;
  }
  if (name === 'care_tip') return `care_tip-${String(args.plantId)}-${String(args.topic)}`;
  return `${name}-${JSON.stringify(args)}`;
}

const groups = groupByToolCall(readFeature(featurePath));

for (const group of groups) {
  const title = testTitleFor(group.call);
  const uiThens = sortUiThens(
    [...new Set(group.examples.flatMap((ex) => ex.thens.filter((t) => !t.startsWith('the helper calls '))))],
  );

  test(`Tier A: ${title}`, { tag: '@helper' }, async ({ page, request }) => {
    test.setTimeout(120_000);

    await freshCustomer(page, request);
    const helper = new HelperPage(page);
    await helper.open();
    await helper.run(group.call.name as ToolName, group.call.args);

    const ctx = { page, helper };
    const thenResults = new Map<string, Awaited<ReturnType<typeof runCheck>>>();
    for (const then of uiThens) {
      thenResults.set(then, await runCheck(uiCheck(then), ctx));
    }

    const manifest: ManifestEntry[] = [];
    const failedThens = new Set<string>();

    for (const example of group.examples) {
      for (const then of example.thens) {
        const check = uiCheck(then);
        let result: ManifestEntry['result'];
        let evidence: string | undefined;
        if (then.startsWith('the helper calls ')) {
          result = 'pass';
          evidence = callKey(group.call);
        } else if (!check) {
          result = 'judge';
          evidence = 'needs judge (no automated check at this tier)';
        } else {
          const outcome = thenResults.get(then) ?? { pass: false, evidence: 'missing check run' };
          result = outcome.pass ? 'pass' : 'fail';
          evidence = outcome.evidence;
          if (!outcome.pass) failedThens.add(then);
        }
        manifest.push({
          tier: 'a',
          scenario: example.scenario,
          example: example.when,
          then,
          result,
          evidence,
        });
      }
    }

    writeEntries('a', title, manifest);

    if (failedThens.size > 0) {
      throw new Error(`Failed Thens:\n${[...failedThens].map((t) => `- ${t}`).join('\n')}`);
    }
  });
}