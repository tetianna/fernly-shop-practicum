/**
 * Playwright reporter: aggregates axe-results + axe-shot attachments from @a11y tests
 * into a11y-report/index.html, summary.md, and results.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import type { NodeResult, Result } from 'axe-core';
import {
  type BaselineEntry,
  type ClassifiedNode,
  classifyViolationNodes,
  isBaselineEntryUsed,
  loadBaselineFile,
  selectBlocking,
} from './baseline';
import type { ScanPayload } from './helpers/scan';

export interface A11yReporterOptions {
  /** Output directory (relative to cwd unless absolute). */
  outputFolder: string;
  /** Path to baseline JSON (relative to cwd unless absolute). */
  baseline: string;
  /** Report title shown in HTML and markdown. */
  title?: string;
}

interface PageAggregate {
  page: string;
  url: string;
  elementCount: number;
  impactCounts: Record<ImpactKey, number>;
  rulesPassed: number;
}

interface RuleAggregate {
  ruleId: string;
  impact: Result['impact'];
  help: string;
  description: string;
  tags: string[];
  helpUrl: string;
  /** Unique pages where this rule failed. */
  pages: Set<string>;
  items: ElementReportItem[];
}

type ImpactKey = 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown';

const IMPACT_ORDER: ImpactKey[] = ['critical', 'serious', 'moderate', 'minor', 'unknown'];

const IMPACT_WEIGHT: Record<ImpactKey, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
  unknown: 4,
};

interface ElementReportItem {
  page: string;
  pageUrl: string;
  target: string[];
  targetKey: string;
  htmlSnippet: string;
  summary: string;
  classification: ClassifiedNode['classification'];
  baselineOwner?: string;
  baselineExpires?: string;
  screenshotDataUrl?: string;
  nodeIndex: number;
}

interface ScanRecord extends ScanPayload {
  testTitle: string;
  /** Map axe-shot key `${page}:${ruleId}:${idx}` → data URL */
  screenshots: Record<string, string>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeImpact(impact: Result['impact'] | undefined): ImpactKey {
  if (impact === 'critical' || impact === 'serious' || impact === 'moderate' || impact === 'minor') {
    return impact;
  }
  return 'unknown';
}

function pickWorstImpact(a: Result['impact'] | undefined, b: Result['impact'] | undefined): Result['impact'] {
  const rank = (i: Result['impact'] | undefined): number => {
    const k = normalizeImpact(i);
    return IMPACT_WEIGHT[k];
  };
  return rank(a) <= rank(b) ? (a ?? b) : (b ?? a);
}

function readAttachmentBody(a: { body?: Buffer; path?: string }): Buffer | undefined {
  if (a.body && a.body.length > 0) {
    return a.body;
  }
  if (a.path) {
    try {
      return readFileSync(a.path);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseShotName(name: string): { page: string; ruleId: string; index: number } | undefined {
  const prefix = 'axe-shot:';
  if (!name.startsWith(prefix)) {
    return undefined;
  }
  const rest = name.slice(prefix.length);
  const parts = rest.split(':');
  if (parts.length < 3) {
    return undefined;
  }
  const index = Number(parts[parts.length - 1]);
  if (!Number.isFinite(index)) {
    return undefined;
  }
  const ruleId = parts[parts.length - 2] as string;
  const page = parts.slice(0, -2).join(':');
  return { page, ruleId, index };
}

function projectNameForTest(test: TestCase): string | undefined {
  let s: Suite | undefined = test.parent;
  while (s) {
    if (s.type === 'project') {
      return s.project()?.name;
    }
    s = s.parent;
  }
  return undefined;
}

function fallbackFailureSummary(rule: Result, node: NodeResult): string {
  const anyNode = node as unknown as { failureSummary?: string };
  if (typeof anyNode.failureSummary === 'string' && anyNode.failureSummary.trim()) {
    return anyNode.failureSummary;
  }
  return rule.description;
}

function buildReportData(
  baselineEntries: BaselineEntry[],
  scans: ScanRecord[],
): {
  pages: PageAggregate[];
  rulesMap: Map<string, RuleAggregate>;
  allClassified: ClassifiedNode[];
  blocking: ClassifiedNode[];
  orphanBaselines: BaselineEntry[];
  totals: {
    pagesScanned: number;
    rulesViolated: number;
    elementsAffected: number;
    blocking: number;
  };
  impactStatusCounts: Record<ImpactKey, { new: number; baselined: number; expired: number }>;
} {
  const ruleIds = new Set<string>();
  let elementsAffected = 0;

  const pagesMap = new Map<string, PageAggregate>();
  const rulesMap = new Map<string, RuleAggregate>();
  const allClassified: ClassifiedNode[] = [];

  for (const scan of scans) {
    const pg = scan.page;
    let pageAgg = pagesMap.get(pg);
    if (!pageAgg) {
      pageAgg = {
        page: pg,
        url: scan.url,
        elementCount: 0,
        impactCounts: { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 },
        rulesPassed: scan.passes?.length ?? 0,
      };
      pagesMap.set(pg, pageAgg);
    } else {
      pageAgg.rulesPassed += scan.passes?.length ?? 0;
    }

    for (const violation of scan.violations) {
      ruleIds.add(violation.id);
      const impact = normalizeImpact(violation.impact);
      const classifiedNodes = classifyViolationNodes(pg, violation, baselineEntries);
      allClassified.push(...classifiedNodes);

      let ruleAgg = rulesMap.get(violation.id);
      if (!ruleAgg) {
        ruleAgg = {
          ruleId: violation.id,
          impact: violation.impact,
          help: violation.help,
          description: violation.description,
          tags: [...(violation.tags ?? [])],
          helpUrl: violation.helpUrl,
          pages: new Set(),
          items: [],
        };
        rulesMap.set(violation.id, ruleAgg);
      } else {
        ruleAgg.impact = pickWorstImpact(ruleAgg.impact, violation.impact);
      }

      violation.nodes.forEach((node, nodeIndex) => {
        elementsAffected += 1;
        pageAgg!.elementCount += 1;
        pageAgg!.impactCounts[impact] += 1;

        const cls = classifiedNodes[nodeIndex];
        const shotKey = `${pg}:${violation.id}:${nodeIndex}`;
        const screenshotDataUrl = scan.screenshots[shotKey];

        ruleAgg!.pages.add(pg);
        ruleAgg!.items.push({
          page: pg,
          pageUrl: scan.url,
          target: node.target,
          targetKey: node.target.join(' >> '),
          htmlSnippet: node.html,
          summary: fallbackFailureSummary(violation, node),
          classification: cls.classification,
          baselineOwner: cls.baseline?.owner,
          baselineExpires: cls.baseline?.expires,
          screenshotDataUrl,
          nodeIndex,
        });
      });
    }
  }

  const blocking = selectBlocking(allClassified);

  const impactStatusCounts = {} as Record<ImpactKey, { new: number; baselined: number; expired: number }>;
  for (const k of IMPACT_ORDER) {
    impactStatusCounts[k] = { new: 0, baselined: 0, expired: 0 };
  }
  for (const c of allClassified) {
    const ik = normalizeImpact(c.impact);
    impactStatusCounts[ik][c.classification] += 1;
  }

  const scanSlices = scans.map((s) => ({ page: s.page, violations: s.violations }));
  const orphanBaselines = baselineEntries.filter((e) => !isBaselineEntryUsed(e, scanSlices));

  const pages = [...pagesMap.values()].sort((a, b) => a.page.localeCompare(b.page));

  return {
    pages,
    rulesMap,
    allClassified,
    blocking,
    orphanBaselines,
    totals: {
      pagesScanned: pages.length,
      rulesViolated: ruleIds.size,
      elementsAffected,
      blocking: blocking.length,
    },
    impactStatusCounts,
  };
}

function renderPagesTable(pages: PageAggregate[]): string {
  const rows = pages
    .map((p) => {
      const total = Math.max(
        1,
        p.impactCounts.critical + p.impactCounts.serious + p.impactCounts.moderate + p.impactCounts.minor + p.impactCounts.unknown,
      );
      const bar = (impact: ImpactKey, color: string) => {
        const n = p.impactCounts[impact];
        const pct = total > 0 ? (n / total) * 100 : 0;
        return `<span class="bar-seg" style="width:${pct.toFixed(2)}%;background:${color}" title="${impact}: ${n}"></span>`;
      };
      return `<tr data-page="${escapeHtml(p.page)}">
  <td>${escapeHtml(p.page)}</td>
  <td class="url"><a href="${escapeHtml(p.url)}">${escapeHtml(p.url)}</a></td>
  <td>${p.elementCount}</td>
  <td><div class="impact-bar">${bar('critical', '#b91c1c')}${bar('serious', '#ea580c')}${bar('moderate', '#ca8a04')}${bar('minor', '#16a34a')}${bar('unknown', '#64748b')}</div></td>
  <td>${p.rulesPassed}</td>
</tr>`;
    })
    .join('\n');

  return `<table class="pages-table" id="pages-table">
<thead><tr><th>Page</th><th>URL</th><th>Elements</th><th>Impact mix</th><th>Rules passed</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

function renderRuleCards(rulesSorted: RuleAggregate[]): string {
  return rulesSorted
    .map((rule) => {
      const wcagTags = rule.tags.filter((t) => t.startsWith('wcag') || t.includes('wcag'));
      const itemsHtml = rule.items
        .sort((a, b) => {
          const clsOrder = { new: 0, baselined: 1, expired: 2 };
          return clsOrder[a.classification] - clsOrder[b.classification] || a.page.localeCompare(b.page);
        })
        .map((el) => {
          const label =
            el.classification === 'new' ? 'New' : el.classification === 'baselined' ? 'Baselined' : 'Expired';
          const labelClass = `lbl-${el.classification}`;
          const shot = el.screenshotDataUrl
            ? `<div class="shot"><img src="${el.screenshotDataUrl}" alt=""/></div>`
            : `<div class="shot shot-missing">No screenshot (axe captures first 3 nodes per rule)</div>`;
          const baselineExtra =
            el.classification !== 'new' && el.baselineOwner
              ? `<p class="baseline-meta"><strong>Owner:</strong> ${escapeHtml(el.baselineOwner)} · <strong>Until:</strong> ${escapeHtml(el.baselineExpires ?? '')}</p>`
              : '';
          return `<div class="elem" data-page="${escapeHtml(el.page)}" data-impact="${normalizeImpact(rule.impact)}" data-status="${el.classification}">
  ${shot}
  <div class="elem-body">
    <p><span class="badge ${labelClass}">${label}</span> <strong>${escapeHtml(el.page)}</strong></p>
    <p class="sel"><code>${escapeHtml(el.targetKey)}</code></p>
    <pre class="html-snippet">${escapeHtml(el.htmlSnippet)}</pre>
    <p class="summary">${escapeHtml(el.summary)}</p>
    ${baselineExtra}
  </div>
</div>`;
        })
        .join('\n');

      return `<article class="rule-card" data-rule="${escapeHtml(rule.ruleId)}" data-impact="${normalizeImpact(rule.impact)}">
  <header>
    <span class="impact-tag impact-${normalizeImpact(rule.impact)}">${escapeHtml(normalizeImpact(rule.impact))}</span>
    <h3>${escapeHtml(rule.help)} <code>${escapeHtml(rule.ruleId)}</code></h3>
    <p class="desc">${escapeHtml(rule.description)}</p>
    <p class="tags">${wcagTags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</p>
    <p><a href="${escapeHtml(rule.helpUrl)}" rel="noopener noreferrer">How to fix it →</a></p>
  </header>
  <div class="elements">${itemsHtml}</div>
</article>`;
    })
    .join('\n');
}

function renderIndexHtml(
  title: string,
  data: ReturnType<typeof buildReportData>,
  rulesSorted: RuleAggregate[],
): string {
  const { totals, pages, impactStatusCounts, orphanBaselines } = data;

  const filterCountsHtml = IMPACT_ORDER.map((ik) => {
    const c = impactStatusCounts[ik];
    const sum = c.new + c.baselined + c.expired;
    return `<label><input type="checkbox" data-filter="impact" value="${ik}" checked/> ${escapeHtml(ik)} (${sum})</label>`;
  }).join(' ');

  const pageOptions =
    `<option value="">All pages</option>` +
    pages.map((p) => `<option value="${escapeHtml(p.page)}">${escapeHtml(p.page)}</option>`).join('');

  const statusOptions = `
<option value="">All statuses</option>
<option value="new">New</option>
<option value="baselined">Baselined</option>
<option value="expired">Expired</option>`;

  const orphanHtml =
    orphanBaselines.length === 0
      ? '<p class="muted">No unused baseline entries.</p>'
      : `<ul class="orphan-list">${orphanBaselines.map((o) => `<li><code>${escapeHtml(o.rule)}</code> · ${escapeHtml(o.page)} · <code>${escapeHtml(o.target)}</code> — remove from baseline (no longer matches any scan)</li>`).join('')}</ul>`;

  const reportJson = JSON.stringify({
    totals,
    pages,
    rules: rulesSorted.map((r) => ({
      ruleId: r.ruleId,
      impact: r.impact,
      help: r.help,
      description: r.description,
      tags: r.tags,
      helpUrl: r.helpUrl,
      pages: [...r.pages],
      items: r.items,
    })),
    impactStatusCounts,
    orphanBaselines,
  }).replace(/</g, '\\u003c');

  const css = `
:root { font-family: system-ui, Segoe UI, sans-serif; color: #0f172a; background: #f8fafc; }
body { margin: 0; line-height: 1.5; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
header.hero { background: #0f172a; color: #f8fafc; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 1.5rem; }
header.hero h1 { margin: 0 0 1rem; font-size: 1.5rem; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.stat { background: #1e293b; padding: 1rem; border-radius: 6px; text-align: center; }
.stat strong { display: block; font-size: 1.75rem; }
.filters { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
.filters label { margin-right: 0.75rem; font-size: 0.9rem; }
.filters input[type="search"] { min-width: 220px; padding: 0.4rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px; }
.pages-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px #0001; margin-bottom: 2rem; font-size: 0.9rem; }
.pages-table th, .pages-table td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
.pages-table .url { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
.impact-bar { display: flex; height: 10px; border-radius: 4px; overflow: hidden; background: #e2e8f0; }
.bar-seg { display: inline-block; height: 100%; min-width: 2px; }
.rule-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 1px 2px #0001; }
.rule-card.hidden { display: none; }
.rule-card header h3 { margin: 0.25rem 0; font-size: 1.1rem; }
.impact-tag { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 4px; color: #fff; }
.impact-critical { background: #b91c1c; }
.impact-serious { background: #ea580c; }
.impact-moderate { background: #ca8a04; }
.impact-minor { background: #16a34a; }
.impact-unknown { background: #64748b; }
.tags .tag { font-size: 0.75rem; background: #e0f2fe; color: #0369a1; padding: 0.15rem 0.4rem; border-radius: 3px; margin-right: 0.35rem; }
.elements { margin-top: 1rem; }
.elem { display: flex; gap: 1rem; border-top: 1px solid #f1f5f9; padding: 1rem 0; flex-wrap: wrap; }
.elem.hidden { display: none; }
.shot { flex: 0 0 200px; }
.shot img { max-width: 200px; height: auto; border: 1px solid #e2e8f0; border-radius: 4px; }
.shot-missing { font-size: 0.8rem; color: #64748b; width: 200px; }
.elem-body { flex: 1; min-width: 200px; }
.html-snippet { background: #f1f5f9; padding: 0.5rem; border-radius: 4px; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
.badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px; color: #fff; margin-right: 0.35rem; }
.lbl-new { background: #dc2626; }
.lbl-baselined { background: #2563eb; }
.lbl-expired { background: #9333ea; }
.muted { color: #64748b; }
.orphan-list { background: #fff7ed; border: 1px solid #fed7aa; padding: 1rem 1.25rem; border-radius: 8px; }
section { margin-bottom: 2rem; }
h2 { font-size: 1.15rem; margin: 0 0 0.75rem; }
`;

  const js = `
(function(){
  var data = JSON.parse(document.getElementById('report-data').textContent);
  function norm(s){ return (s||'').toLowerCase(); }
  function apply(){
    var q = norm(document.getElementById('q').value);
    var pageSel = document.getElementById('page-filter').value;
    var statusSel = document.getElementById('status-filter').value;
    var impacts = {};
    document.querySelectorAll('input[data-filter="impact"]').forEach(function(cb){
      impacts[cb.value] = cb.checked;
    });
    document.querySelectorAll('.rule-card').forEach(function(card){
      var ruleId = card.getAttribute('data-rule')||'';
      var impact = card.getAttribute('data-impact')||'';
      if(!impacts[impact]){ card.classList.add('hidden'); return; }
      var showCard = false;
      card.querySelectorAll('.elem').forEach(function(el){
        var p = el.getAttribute('data-page')||'';
        var st = el.getAttribute('data-status')||'';
        var text = norm(el.textContent||'');
        var okPage = !pageSel || p === pageSel;
        var okStatus = !statusSel || st === statusSel;
        var okQ = !q || text.indexOf(q) !== -1 || norm(ruleId).indexOf(q) !== -1;
        var vis = okPage && okStatus && okQ;
        if(vis) showCard = true;
        el.classList.toggle('hidden', !vis);
      });
      card.classList.toggle('hidden', !showCard);
    });
    document.querySelectorAll('#pages-table tbody tr').forEach(function(tr){
      var p = tr.getAttribute('data-page')||'';
      var ok = !pageSel || p === pageSel;
      tr.style.display = ok ? '' : 'none';
    });
  }
  document.getElementById('q').addEventListener('input', apply);
  document.getElementById('page-filter').addEventListener('change', apply);
  document.getElementById('status-filter').addEventListener('change', apply);
  document.querySelectorAll('input[data-filter="impact"]').forEach(function(cb){
    cb.addEventListener('change', apply);
  });
})();
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>${escapeHtml(title)}</h1>
    <div class="stats">
      <div class="stat"><strong>${totals.pagesScanned}</strong>Pages scanned</div>
      <div class="stat"><strong>${totals.rulesViolated}</strong>Rules violated</div>
      <div class="stat"><strong>${totals.elementsAffected}</strong>Elements affected</div>
      <div class="stat"><strong>${totals.blocking}</strong>Blocking</div>
    </div>
  </header>

  <section>
    <h2>Filters</h2>
    <div class="filters">
      <span>Impact:</span>
      ${filterCountsHtml}
      <label>Page <select id="page-filter">${pageOptions}</select></label>
      <label>Status <select id="status-filter">${statusOptions}</select></label>
      <label>Search <input id="q" type="search" placeholder="Rule id, selector, text…"/></label>
    </div>
  </section>

  <section>
    <h2>Pages</h2>
    ${renderPagesTable(pages)}
  </section>

  <section>
    <h2>Violations by rule</h2>
    ${renderRuleCards(rulesSorted)}
  </section>

  <section>
    <h2>Baseline entries to remove</h2>
    ${orphanHtml}
  </section>
</div>
<script type="application/json" id="report-data">${reportJson}</script>
<script>${js}</script>
</body>
</html>`;
}

function renderSummaryMd(title: string, data: ReturnType<typeof buildReportData>, rulesSorted: RuleAggregate[]): string {
  const { totals, impactStatusCounts, blocking, orphanBaselines } = data;

  const impactRows = IMPACT_ORDER.map((ik) => {
    const c = impactStatusCounts[ik];
    return `| ${ik} | ${c.new} | ${c.baselined} | ${c.expired} |`;
  }).join('\n');

  const blockingByRule = new Map<string, Map<string, ClassifiedNode[]>>();
  for (const b of blocking) {
    if (!blockingByRule.has(b.rule)) {
      blockingByRule.set(b.rule, new Map());
    }
    const byPage = blockingByRule.get(b.rule)!;
    if (!byPage.has(b.page)) {
      byPage.set(b.page, []);
    }
    byPage.get(b.page)!.push(b);
  }

  const blockingSection: string[] = [];
  const ruleKeys = [...blockingByRule.keys()].sort();
  for (const ruleId of ruleKeys) {
    blockingSection.push(`### ${ruleId}`);
    const pagesMap = blockingByRule.get(ruleId)!;
    const pageKeys = [...pagesMap.keys()].sort();
    for (const pg of pageKeys) {
      const nodes = pagesMap.get(pg)!;
      const example = nodes[0]?.targetKey ?? '';
      blockingSection.push(`- **${pg}** — ${nodes.length} finding(s); example: \`${example.replace(/`/g, "'")}\``);
    }
    blockingSection.push('');
  }

  const orphanLines =
    orphanBaselines.length === 0
      ? '_None — every baseline entry matched at least one finding._'
      : orphanBaselines.map((o) => `- \`${o.rule}\` / ${o.page} / \`${o.target}\``).join('\n');

  return `# ${title}

## Totals

| Metric | Count |
| --- | ---: |
| Pages scanned | ${totals.pagesScanned} |
| Rules violated | ${totals.rulesViolated} |
| Elements affected | ${totals.elementsAffected} |
| Blocking | ${totals.blocking} |

## By impact and status

| Impact | New | Baselined | Expired |
| --- | ---: | ---: | ---: |
${impactRows}

## Blocking violations

${blockingSection.join('\n') || '_None._'}

## Unused baseline entries (delete from baseline file)

${orphanLines}
`;
}

export default class A11yReporter implements Reporter {
  private readonly options: A11yReporterOptions;

  private readonly title: string;

  constructor(options: A11yReporterOptions) {
    if (!options?.outputFolder) {
      throw new Error('A11y reporter: outputFolder is required');
    }
    if (!options?.baseline) {
      throw new Error('A11y reporter: baseline path is required');
    }
    this.options = options;
    this.title = options.title ?? 'Accessibility report';
  }

  printsToStdio(): boolean {
    return false;
  }

  async onEnd(_result: FullResult): Promise<void> {
    const suite = (this as unknown as { _suite?: Suite })._suite;
    if (!suite) {
      return;
    }

    const cwd = process.cwd();
    const outputDir = path.resolve(cwd, this.options.outputFolder);
    const baselinePath = path.resolve(cwd, this.options.baseline);

    const baselineEntries = loadBaselineFile(baselinePath);

    const scans: ScanRecord[] = [];
    for (const test of suite.allTests()) {
      if (projectNameForTest(test) !== 'a11y') {
        continue;
      }
      const result = test.results[test.results.length - 1];
      if (!result || result.status === 'skipped') {
        continue;
      }
      const axeAtt = result.attachments.find((a) => a.name === 'axe-results');
      if (!axeAtt) {
        continue;
      }
      const buf = readAttachmentBody(axeAtt);
      if (!buf) {
        continue;
      }
      let payload: ScanPayload;
      try {
        payload = JSON.parse(buf.toString('utf-8')) as ScanPayload;
      } catch {
        continue;
      }

      const screenshots: Record<string, string> = {};
      for (const att of result.attachments) {
        const parsed = parseShotName(att.name);
        if (!parsed) {
          continue;
        }
        const imgBuf = readAttachmentBody(att);
        if (!imgBuf) {
          continue;
        }
        const key = `${parsed.page}:${parsed.ruleId}:${parsed.index}`;
        screenshots[key] = `data:image/png;base64,${imgBuf.toString('base64')}`;
      }

      scans.push({
        ...payload,
        testTitle: test.title,
        screenshots,
      });
    }

    mkdirSync(outputDir, { recursive: true });

    const built = buildReportData(baselineEntries, scans);
    const rulesSorted = [...built.rulesMap.values()].sort((a, b) => {
      const ia = IMPACT_WEIGHT[normalizeImpact(a.impact)];
      const ib = IMPACT_WEIGHT[normalizeImpact(b.impact)];
      if (ia !== ib) {
        return ia - ib;
      }
      return a.ruleId.localeCompare(b.ruleId);
    });

    const indexHtml = renderIndexHtml(this.title, built, rulesSorted);
    writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');

    const summaryMd = renderSummaryMd(this.title, built, rulesSorted);
    writeFileSync(path.join(outputDir, 'summary.md'), summaryMd, 'utf-8');

    const resultsJson = {
      title: this.title,
      generatedAt: new Date().toISOString(),
      baselinePath: this.options.baseline,
      outputFolder: this.options.outputFolder,
      totals: built.totals,
      pages: built.pages,
      rules: rulesSorted.map((r) => ({
        ...r,
        pages: [...r.pages],
      })),
      classified: built.allClassified,
      blocking: built.blocking,
      orphanBaselines: built.orphanBaselines,
      impactStatusCounts: built.impactStatusCounts,
      scans: scans.map((s) => ({
        page: s.page,
        url: s.url,
        scannedAt: s.scannedAt,
        testTitle: s.testTitle,
        violations: s.violations,
        passesCount: s.passes?.length ?? 0,
        incompleteCount: s.incomplete?.length ?? 0,
      })),
    };
    writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify(resultsJson, null, 2), 'utf-8');

    const outPath = path.join(outputDir, 'index.html');
    console.log(
      `[a11y reporter] pages=${built.totals.pagesScanned} rules=${built.totals.rulesViolated} elements=${built.totals.elementsAffected} blocking=${built.totals.blocking} → ${outPath}`,
    );
  }

  onBegin(config: FullConfig, suite: Suite): void {
    (this as unknown as { _suite: Suite })._suite = suite;
    (this as unknown as { _config: FullConfig })._config = config;
  }
}
