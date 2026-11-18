#!/usr/bin/env node
/**
 * Deterministic QA report from Playwright JSON, Cypress JUnit, a11y summary, and FINDINGS.md.
 * Usage: node scripts/qa-report.mjs build | publish [--dry-run]
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'qa-report');
const MARKER = '<!-- fernly-qa-report -->';
const FINDING_KEY = /<!-- qa-finding-key:\s*([^\s>]+)\s*-->/;

const PATHS = {
  playwrightJson: path.join(ROOT, 'reports', 'playwright.json'),
  cypressResults: path.join(ROOT, 'web', 'cypress', 'results'),
  a11ySummary: path.join(ROOT, 'a11y-report', 'summary.md'),
  findings: path.join(ROOT, 'FINDINGS.md'),
  playwrightReport: path.join(ROOT, 'playwright-report'),
};

function stripAnsi(text) {
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

function firstLine(text) {
  const line = stripAnsi(text).split(/\r?\n/).find((l) => l.trim());
  return line ?? '';
}

function slugTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Parse `### BUG-NNN: Title` blocks under ## Bugs */
function parseFindings(md) {
  const findings = [];
  const bugsStart = md.indexOf('## Bugs');
  if (bugsStart === -1) {
    return findings;
  }
  const section = md.slice(bugsStart);
  const re = /^### BUG-\d+:\s*(.+)$/gm;
  let match;
  const headings = [];
  while ((match = re.exec(section)) !== null) {
    headings.push({ title: match[1].trim(), index: match.index, line: match[0] });
  }
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : section.length;
    const body = section.slice(start, end).trim();
    findings.push({
      title: headings[i].title,
      slug: slugTitle(headings[i].title),
      body,
    });
  }
  return findings;
}

function readOptional(filePath, label) {
  if (!existsSync(filePath)) {
    return { status: 'not run', label };
  }
  return { status: 'ok', content: readFileSync(filePath, 'utf-8') };
}

function gitShowFindings(baseRef) {
  const ref = `origin/${baseRef}:FINDINGS.md`;
  const res = spawnSync('git', ['show', ref], { encoding: 'utf-8', cwd: ROOT });
  if (res.status !== 0) {
    return '';
  }
  return res.stdout;
}

function walkPlaywrightSuites(suites, visitor) {
  if (!suites) {
    return;
  }
  for (const suite of suites) {
    walkPlaywrightSuites(suite.suites, visitor);
    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const test of spec.tests ?? []) {
          visitor(test, spec, suite);
        }
      }
    }
  }
}

function namesFinding(text, findingTitles) {
  if (!text) {
    return false;
  }
  if (/FINDINGS|BUG-\d+/i.test(text)) {
    return true;
  }
  return findingTitles.some((t) => text.includes(t));
}

function annotationNamesFinding(annotations, findingTitles) {
  if (!annotations?.length) {
    return false;
  }
  for (const ann of annotations) {
    const type = (ann.type ?? '').toLowerCase();
    if (type === 'fail' || type.includes('fail')) {
      if (namesFinding(ann.description, findingTitles)) {
        return true;
      }
    }
  }
  return false;
}

function testOutcome(test, findingTitles) {
  const results = test.results ?? [];
  const last = results[results.length - 1];
  if (!last) {
    return { bucket: 'skipped', status: 'unknown' };
  }
  const status = last.status;
  const known =
    annotationNamesFinding(test.annotations, findingTitles) ||
    (status === 'failed' &&
      (last.expectedStatus === 'failed' ||
        (last.errors ?? []).some((e) => namesFinding(e.message, findingTitles))));

  if (status === 'skipped') {
    return { bucket: 'skipped', status, known: false, result: last };
  }
  if (known && status === 'failed') {
    return { bucket: 'known', status, known: true, result: last };
  }
  if (status === 'passed') {
    return { bucket: 'passed', status, known: false, result: last };
  }
  if (status === 'failed' || status === 'timedOut' || status === 'interrupted') {
    return { bucket: 'failed', status, known: false, result: last };
  }
  if (status === 'skipped') {
    return { bucket: 'skipped', status, known: false, result: last };
  }
  return { bucket: 'skipped', status, known: false, result: last };
}

function failureLocation(test, result) {
  const loc = result?.location ?? test?.location;
  if (loc?.file && loc?.line != null) {
    return `${loc.file}:${loc.line}`;
  }
  const err = result?.errors?.[0];
  if (err?.location?.file) {
    return `${err.location.file}:${err.location.line ?? '?'}`;
  }
  return test?.title ?? 'unknown';
}

function parsePlaywrightReport(jsonText, findingTitles) {
  const data = JSON.parse(jsonText);
  const projectStats = new Map();
  const failures = [];
  const knownBugTests = [];
  const visualFailures = [];

  const ensureProject = (name) => {
    if (!projectStats.has(name)) {
      projectStats.set(name, { passed: 0, failed: 0, known: 0, skipped: 0 });
    }
    return projectStats.get(name);
  };

  walkPlaywrightSuites(data.suites ?? [], (test) => {
    const project = test.projectName ?? 'playwright';
    const stats = ensureProject(project);
    const outcome = testOutcome(test, findingTitles);
    stats[outcome.bucket === 'known' ? 'known' : outcome.bucket] += 1;

    if (outcome.bucket === 'failed') {
      const errMsg = outcome.result?.errors?.[0]?.message ?? outcome.result?.error?.message ?? '';
      failures.push({
        suite: `Playwright (${project})`,
        name: test.title,
        where: failureLocation(test, outcome.result),
        error: firstLine(errMsg),
      });
    }
    if (outcome.bucket === 'known') {
      const ann = (test.annotations ?? []).find((a) =>
        namesFinding(a.description, findingTitles),
      );
      knownBugTests.push({
        project,
        title: test.title,
        finding: ann?.description ?? firstLine(outcome.result?.errors?.[0]?.message ?? ''),
      });
    }
    if (project === 'visual' && outcome.bucket === 'failed') {
      const errMsg = outcome.result?.errors?.[0]?.message ?? '';
      const snapshotMatch = /Snapshot:\s*(\S+)/.exec(errMsg);
      visualFailures.push({
        title: test.title,
        where: failureLocation(test, outcome.result),
        error: firstLine(errMsg),
        snapshot: snapshotMatch?.[1],
      });
    }
  });

  return { projectStats, failures, knownBugTests, visualFailures, raw: data };
}

function parseJunitXml(xml, suiteLabel) {
  const stats = { passed: 0, failed: 0, known: 0, skipped: 0 };
  const failures = [];
  let specFile = '';
  const specFileRe = /<testsuite\b[^>]*\bfile="([^"]+)"/g;
  let sf;
  while ((sf = specFileRe.exec(xml)) !== null) {
    specFile = sf[1];
  }
  const testcaseRe =
    /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^/>]*)\/>/g;
  let m;
  while ((m = testcaseRe.exec(xml)) !== null) {
    const attrs = m[1] ?? m[3] ?? '';
    const inner = m[2] ?? '';
    const nameMatch = /\bname="([^"]*)"/.exec(attrs);
    const classMatch = /\bclassname="([^"]*)"/.exec(attrs);
    const name = nameMatch?.[1] ?? classMatch?.[1] ?? 'unknown';
    const skipped = /<skipped\b/.test(inner) || /\bskipped="[^"]*"/i.test(attrs);
    const failureMatch = /<failure\b([^>]*)>([\s\S]*?)<\/failure>/.exec(inner);
    const where = specFile
      ? `web/cypress/${specFile.replace(/\\/g, '/')}`
      : `${suiteLabel} (junit)`;

    if (skipped) {
      stats.skipped += 1;
      continue;
    }
    if (failureMatch) {
      stats.failed += 1;
      const msgAttr = /\bmessage="([^"]*)"/.exec(failureMatch[1]);
      const body = failureMatch[2] ?? '';
      const errText = msgAttr?.[1] ?? body;
      failures.push({
        suite: suiteLabel,
        name,
        where,
        error: firstLine(errText),
      });
    } else {
      stats.passed += 1;
    }
  }
  return { stats, failures };
}

function loadCypressSuites() {
  const dir = PATHS.cypressResults;
  if (!existsSync(dir)) {
    return {
      component: { status: 'not run', stats: null, failures: [] },
      ui: { status: 'not run', stats: null, failures: [] },
    };
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.xml'));
  let component = { status: 'not run', stats: null, failures: [] };
  let ui = { status: 'not run', stats: null, failures: [] };
  for (const file of files) {
    const xml = readFileSync(path.join(dir, file), 'utf-8');
    if (file.includes('component')) {
      const parsed = parseJunitXml(xml, 'Cypress component');
      component = {
        status: 'ok',
        stats: parsed.stats,
        failures: parsed.failures,
      };
    } else if (file.includes('ui')) {
      const parsed = parseJunitXml(xml, 'Cypress UI');
      ui = { status: 'ok', stats: parsed.stats, failures: parsed.failures };
    } else if (component.status === 'not run') {
      const parsed = parseJunitXml(xml, 'Cypress component');
      component = { status: 'ok', stats: parsed.stats, failures: parsed.failures };
    } else if (ui.status === 'not run') {
      const parsed = parseJunitXml(xml, 'Cypress UI');
      ui = { status: 'ok', stats: parsed.stats, failures: parsed.failures };
    }
  }
  return { component, ui };
}

function formatStatsRow(name, stats, notRun) {
  if (notRun) {
    return `| ${name} | not run | not run | not run | not run |`;
  }
  return `| ${name} | ${stats.passed} | ${stats.failed} | ${stats.known} | ${stats.skipped} |`;
}

function env(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function runUrl() {
  const repo = env('GITHUB_REPOSITORY');
  const runId = env('GITHUB_RUN_ID');
  const server = env('GITHUB_SERVER_URL', 'https://github.com');
  if (repo && runId) {
    return `${server}/${repo}/actions/runs/${runId}`;
  }
  return env('RUN_URL', '');
}

function prUrl() {
  const repo = env('GITHUB_REPOSITORY');
  const pr = env('PR_NUMBER');
  const server = env('GITHUB_SERVER_URL', 'https://github.com');
  if (repo && pr) {
    return `${server}/${repo}/pull/${pr}`;
  }
  return '';
}

function buildReport() {
  const baseRef = env('BASE_REF', 'main');
  const findingsMd = readOptional(PATHS.findings, 'FINDINGS.md');
  const currentFindings =
    findingsMd.status === 'ok' ? parseFindings(findingsMd.content) : [];
  const baseMd = gitShowFindings(baseRef);
  const baseFindings = baseMd ? parseFindings(baseMd) : [];
  const baseTitles = new Set(baseFindings.map((f) => f.title));
  const newFindings = currentFindings.filter((f) => !baseTitles.has(f.title));
  const findingTitles = currentFindings.map((f) => f.title);

  const pwFile = readOptional(PATHS.playwrightJson, 'Playwright JSON');
  let pw = null;
  if (pwFile.status === 'ok') {
    pw = parsePlaywrightReport(pwFile.content, findingTitles);
  }

  const cypress = loadCypressSuites();
  const a11y = readOptional(PATHS.a11ySummary, 'a11y summary');

  const suiteRows = [];
  suiteRows.push(
    formatStatsRow(
      'Cypress component',
      cypress.component.stats,
      cypress.component.status === 'not run',
    ),
  );
  suiteRows.push(
    formatStatsRow('Cypress UI', cypress.ui.stats, cypress.ui.status === 'not run'),
  );

  const pwProjects = pw?.projectStats ?? new Map();
  if (pwFile.status === 'not run') {
    for (const name of ['setup', 'api', 'e2e', 'a11y', 'visual']) {
      suiteRows.push(formatStatsRow(`Playwright (${name})`, null, true));
    }
  } else {
    const names = [...pwProjects.keys()].sort();
    for (const name of names) {
      suiteRows.push(formatStatsRow(`Playwright (${name})`, pwProjects.get(name), false));
    }
  }

  const allFailures = [
    ...cypress.component.failures,
    ...cypress.ui.failures,
    ...(pw?.failures ?? []),
  ];

  const sha = env('GITHUB_SHA', '');
  const runLink = runUrl();
  const prLink = prUrl();

  let comment = `${MARKER}\n\n`;
  comment += `## QA report\n\n`;
  if (sha) {
    comment += `Commit: \`${sha.slice(0, 7)}\`\n\n`;
  }
  if (runLink) {
    comment += `[Workflow run](${runLink})\n\n`;
  }

  comment += `### Suite summary\n\n`;
  comment += `| Suite | Passed | Failed | Known bugs | Skipped |\n`;
  comment += `| --- | ---: | ---: | ---: | ---: |\n`;
  comment += `${suiteRows.join('\n')}\n\n`;

  if (allFailures.length) {
    comment += `### Failed tests\n\n`;
    for (const f of allFailures) {
      comment += `- **${f.suite}** — ${f.name} — \`${f.where}\` — ${f.error}\n`;
    }
    comment += '\n';
  }

  const visual = pw?.visualFailures ?? [];
  if (visual.length) {
    comment += `### Visual regressions\n\n`;
    comment += `_A person decides: defect, intended, or noise._ Screenshots live in the **playwright-report** artifact.\n\n`;
    for (const v of visual) {
      comment += `- **${v.title}** — \`${v.where}\`${v.snapshot ? ` — snapshot \`${v.snapshot}\`` : ''} — ${v.error}\n`;
    }
    comment += '\n';
  }

  const known = pw?.knownBugTests ?? [];
  if (known.length) {
    comment += `### Known bugs (expected failures)\n\n`;
    for (const k of known) {
      comment += `- **${k.project}** — ${k.title} — ${k.finding}\n`;
    }
    comment += '\n';
  }

  if (currentFindings.length) {
    comment += `### FINDINGS (${currentFindings.length} tracked)\n\n`;
    for (const f of currentFindings) {
      comment += `- ${f.title}\n`;
    }
    comment += '\n';
  }

  if (newFindings.length) {
    comment += `### New findings (not on \`${baseRef}\`)\n\n`;
    for (const f of newFindings) {
      comment += `- **${f.title}**\n`;
    }
    comment += '\n';
  }

  comment += `<details>\n<summary>Accessibility summary</summary>\n\n`;
  if (a11y.status === 'not run') {
    comment += `_Accessibility report not run._\n`;
  } else {
    comment += a11y.content.trim();
    comment += '\n';
  }
  comment += `\n</details>\n`;

  const totals = {
    cypressComponent: cypress.component.stats ?? 'not run',
    cypressUi: cypress.ui.stats ?? 'not run',
    playwright: pwFile.status === 'not run' ? 'not run' : Object.fromEntries(pwProjects),
  };

  const runJson = {
    sha: env('GITHUB_SHA', ''),
    pr: env('PR_NUMBER', ''),
    runUrl: runLink,
    prUrl: prLink,
    generatedAt: new Date().toISOString(),
    baseRef,
    totals,
    failed: allFailures,
    knownBugs: known,
    visualChanges: visual,
    findings: currentFindings.map((f) => f.title),
    newFindings: newFindings.map((f) => f.title),
  };

  const issues = newFindings.map((f) => {
    const footer = [
      '',
      '---',
      prLink ? `PR: ${prLink}` : '',
      runLink ? `Run: ${runLink}` : '',
      `<!-- qa-finding-key: ${f.slug} -->`,
    ]
      .filter(Boolean)
      .join('\n');
    return {
      title: f.title,
      key: f.slug,
      body: `${f.body}\n${footer}`,
    };
  });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'comment.md'), comment, 'utf-8');
  writeFileSync(path.join(OUT_DIR, 'issues.json'), JSON.stringify(issues, null, 2), 'utf-8');
  writeFileSync(path.join(OUT_DIR, 'run.json'), JSON.stringify(runJson, null, 2), 'utf-8');

  return { comment, issues, runJson };
}

function gh(args, input) {
  const res = spawnSync('gh', args, {
    encoding: 'utf-8',
    cwd: ROOT,
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return res;
}

function publishReport(dryRun) {
  const commentPath = path.join(OUT_DIR, 'comment.md');
  const issuesPath = path.join(OUT_DIR, 'issues.json');
  if (!existsSync(commentPath) || !existsSync(issuesPath)) {
    console.error('Run build first — missing qa-report/comment.md or issues.json');
    process.exit(1);
  }

  const comment = readFileSync(commentPath, 'utf-8');
  const issues = JSON.parse(readFileSync(issuesPath, 'utf-8'));
  const repo = env('GITHUB_REPOSITORY');
  const pr = env('PR_NUMBER');

  if (!repo || !pr) {
    console.error('GITHUB_REPOSITORY and PR_NUMBER are required for publish');
    process.exit(1);
  }

  if (dryRun) {
    console.log('--- dry-run: PR comment ---');
    console.log(comment);
    console.log('--- dry-run: would upsert PR comment on', repo, 'PR', pr);

    const listRes = gh([
      'issue',
      'list',
      '--repo',
      repo,
      '--label',
      'qa-finding',
      '--state',
      'all',
      '--json',
      'body,title,number',
      '--limit',
      '200',
    ]);
    const existingKeys = new Set();
    if (listRes.status === 0) {
      const items = JSON.parse(listRes.stdout || '[]');
      for (const item of items) {
        const keyMatch = FINDING_KEY.exec(item.body ?? '');
        if (keyMatch) {
          existingKeys.add(keyMatch[1]);
        }
      }
    }
    for (const issue of issues) {
      if (existingKeys.has(issue.key)) {
        console.log(`--- dry-run: skip issue (exists) key=${issue.key}`);
      } else {
        console.log(`--- dry-run: create issue title=${issue.title} key=${issue.key}`);
        console.log(issue.body);
      }
    }
    return;
  }

  const commentsRes = gh(['api', `repos/${repo}/issues/${pr}/comments`, '--paginate']);
  let commentId = '';
  if (commentsRes.status === 0) {
    const comments = JSON.parse(commentsRes.stdout || '[]');
    const existing = comments.find((c) => (c.body ?? '').startsWith(MARKER));
    commentId = existing?.id ? String(existing.id) : '';
  }

  if (commentId) {
    const patchRes = gh(
      ['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${commentId}`, '--input', '-'],
      JSON.stringify({ body: comment }),
    );
    if (patchRes.status !== 0) {
      console.error(patchRes.stderr);
      process.exit(1);
    }
  } else {
    const createRes = gh(['pr', 'comment', pr, '--repo', repo, '--body-file', commentPath]);
    if (createRes.status !== 0) {
      console.error(createRes.stderr);
      process.exit(1);
    }
  }

  const listRes = gh([
    'issue',
    'list',
    '--repo',
    repo,
    '--label',
    'qa-finding',
    '--state',
    'all',
    '--json',
    'body',
    '--limit',
    '200',
  ]);
  const existingKeys = new Set();
  if (listRes.status === 0) {
    const items = JSON.parse(listRes.stdout || '[]');
    for (const item of items) {
      const keyMatch = FINDING_KEY.exec(item.body ?? '');
      if (keyMatch) {
        existingKeys.add(keyMatch[1]);
      }
    }
  }

  for (const issue of issues) {
    if (existingKeys.has(issue.key)) {
      continue;
    }
    const title = issue.title;
    const bodyFile = path.join(OUT_DIR, `.issue-${issue.key}.md`);
    writeFileSync(bodyFile, issue.body, 'utf-8');
    const createRes = gh([
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      title,
      '--label',
      'qa-finding',
      '--body-file',
      bodyFile,
    ]);
    if (createRes.status !== 0) {
      console.error(createRes.stderr);
      process.exit(1);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const dryRun = args.includes('--dry-run');

  if (cmd === 'build') {
    buildReport();
    console.log(`Wrote ${OUT_DIR}`);
    return;
  }
  if (cmd === 'publish') {
    publishReport(dryRun);
    return;
  }
  console.error('Usage: node scripts/qa-report.mjs build | publish [--dry-run]');
  process.exit(1);
}

main();
