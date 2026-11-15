import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NodeResult, Result } from 'axe-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** One known violation entry; `target` is a selector string or "*" for any element on that page/rule. */
export interface BaselineEntry {
  rule: string;
  page: string;
  target: string;
  owner: string;
  expires: string;
  reason: string;
}

export interface ClassifiedNode {
  rule: string;
  ruleHelpUrl: string | undefined;
  page: string;
  impact: Result['impact'];
  target: string[];
  targetKey: string;
  html: string;
  classification: 'new' | 'baselined' | 'expired';
  baseline: BaselineEntry | undefined;
}

export function loadBaselineFile(filePath: string): BaselineEntry[] {
  const raw = readFileSync(filePath, 'utf-8');
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('Baseline file must contain a JSON array');
  }
  return data as BaselineEntry[];
}

export function loadBaseline(): BaselineEntry[] {
  return loadBaselineFile(path.join(__dirname, 'a11y-baseline.json'));
}

/** Today as YYYY-MM-DD in UTC for stable compares with baseline `expires`. */
export function utcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isBaselineExpired(expires: string, today: string = utcDateString()): boolean {
  const expireMs = Date.parse(`${expires}T23:59:59.999Z`);
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  if (Number.isNaN(expireMs) || Number.isNaN(todayMs)) {
    return expires < today;
  }
  return expireMs < todayMs;
}

export function baselineMatchesNode(
  entry: BaselineEntry,
  ruleId: string,
  pageName: string,
  node: NodeResult,
): boolean {
  if (entry.rule !== ruleId || entry.page !== pageName) {
    return false;
  }
  if (entry.target === '*') {
    return true;
  }
  const joined = node.target.join(' ');
  if (entry.target === joined) {
    return true;
  }
  return node.target.some((segment) => segment === entry.target);
}

function findBaselineForNode(
  baseline: BaselineEntry[],
  ruleId: string,
  pageName: string,
  node: NodeResult,
): BaselineEntry | undefined {
  return baseline.find((b) => baselineMatchesNode(b, ruleId, pageName, node));
}

/**
 * Classifies each axe violation node as new, covered by baseline, or covered by an expired baseline.
 */
export function classifyViolationNodes(
  pageName: string,
  violation: Result,
  baseline: BaselineEntry[],
): ClassifiedNode[] {
  const ruleId = violation.id;
  const ruleHelpUrl = violation.helpUrl;
  const impact = violation.impact;

  return violation.nodes.map((node) => {
    const match = findBaselineForNode(baseline, ruleId, pageName, node);
    const targetKey = node.target.join(' >> ');

    if (!match) {
      return {
        rule: ruleId,
        ruleHelpUrl,
        page: pageName,
        impact,
        target: node.target,
        targetKey,
        html: node.html,
        classification: 'new',
        baseline: undefined,
      } satisfies ClassifiedNode;
    }

    if (isBaselineExpired(match.expires)) {
      return {
        rule: ruleId,
        ruleHelpUrl,
        page: pageName,
        impact,
        target: node.target,
        targetKey,
        html: node.html,
        classification: 'expired',
        baseline: match,
      } satisfies ClassifiedNode;
    }

    return {
      rule: ruleId,
      ruleHelpUrl,
      page: pageName,
      impact,
      target: node.target,
      targetKey,
      html: node.html,
      classification: 'baselined',
      baseline: match,
    } satisfies ClassifiedNode;
  });
}

export function classifyResults(pageName: string, violations: Result[], baseline: BaselineEntry[]): ClassifiedNode[] {
  return violations.flatMap((v) => classifyViolationNodes(pageName, v, baseline));
}

export function selectBlocking(classified: ClassifiedNode[]): ClassifiedNode[] {
  return classified.filter((c) => {
    if (c.classification === 'expired') {
      return true;
    }
    if (c.classification === 'new' && (c.impact === 'serious' || c.impact === 'critical')) {
      return true;
    }
    return false;
  });
}

export function formatBlockingMessage(blocking: ClassifiedNode[]): string {
  if (blocking.length === 0) {
    return '';
  }
  const lines = blocking.map((b) => {
    const parts = [
      `[${b.classification}]`,
      b.rule,
      `page=${b.page}`,
      `impact=${b.impact ?? 'unknown'}`,
      `target=${b.targetKey}`,
    ];
    if (b.baseline) {
      parts.push(`baselineExpires=${b.baseline.expires}`, `owner=${b.baseline.owner}`);
    }
    return parts.join(' | ');
  });
  return `Blocking accessibility findings:\n${lines.join('\n')}`;
}

/** True if this baseline row matched at least one violation node in the given scans. */
export function isBaselineEntryUsed(
  entry: BaselineEntry,
  scans: { page: string; violations: Result[] }[],
): boolean {
  for (const scan of scans) {
    const pageName = scan.page;
    for (const violation of scan.violations) {
      if (violation.id !== entry.rule) {
        continue;
      }
      for (const node of violation.nodes) {
        if (baselineMatchesNode(entry, violation.id, pageName, node)) {
          return true;
        }
      }
    }
  }
  return false;
}
