import AxeBuilder from '@axe-core/playwright';
import type { TestInfo } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { AxeResults, Result } from 'axe-core';
import { classifyResults, loadBaseline, selectBlocking, type ClassifiedNode } from '../baseline';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

export interface ScanPayload {
  page: string;
  url: string;
  scannedAt: string;
  violations: Result[];
  passes: AxeResults['passes'];
  incomplete: AxeResults['incomplete'];
}

export interface ScanPageResult {
  classified: ClassifiedNode[];
  blocking: ClassifiedNode[];
}

/** Playwright locator chain from axe `target` segments (root → leaf). */
function locatorSelector(target: string[]): string {
  return target.join(' >> ');
}

export async function scanPage(
  page: Page,
  testInfo: TestInfo,
  options: { name: string },
): Promise<ScanPageResult> {
  const pageName = options.name;
  const baseline = loadBaseline();

  const axeResults = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();

  const scannedAt = new Date().toISOString();
  const payload: ScanPayload = {
    page: pageName,
    url: page.url(),
    scannedAt,
    violations: axeResults.violations,
    passes: axeResults.passes,
    incomplete: axeResults.incomplete,
  };

  await testInfo.attach('axe-results', {
    body: Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'),
    contentType: 'application/json',
  });

  for (const violation of axeResults.violations) {
    const nodes = violation.nodes.slice(0, 3);
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      try {
        const selector = locatorSelector(node.target);
        const locator = page.locator(selector);
        await locator.first().scrollIntoViewIfNeeded({ timeout: 5_000 });
        const screenshot = await locator.first().screenshot({ timeout: 5_000 });
        await testInfo.attach(`axe-shot:${pageName}:${violation.id}:${index}`, {
          body: screenshot,
          contentType: 'image/png',
        });
      } catch {
        // Element not screenshotable; still report in JSON and classification.
      }
    }
  }

  const classified = classifyResults(pageName, axeResults.violations, baseline);
  const blocking = selectBlocking(classified);

  return { classified, blocking };
}
