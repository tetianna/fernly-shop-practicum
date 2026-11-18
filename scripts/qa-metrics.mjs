#!/usr/bin/env node
/**
 * Read-only QA pipeline metrics via the GitHub CLI. Writes docs/QA-METRICS.md locally.
 * Usage: node scripts/qa-metrics.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(ROOT, 'docs', 'QA-METRICS.md');
const QA_MARKER = '<!-- fernly-qa-report -->';
const PLAN_REVIEW_RE = /^\s*Plan review:\s*(\d+)\s*\/\s*(\d+)/;
const BOT_LOGIN = 'github-actions[bot]';
const WORKFLOW = 'pr-triage.yml';

function gh(args) {
  const res = spawnSync('gh', args, {
    encoding: 'utf-8',
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.status !== 0) {
    const msg = (res.stderr || res.stdout || `gh ${args.join(' ')}`).trim();
    console.error(msg);
    process.exit(1);
  }
  return res.stdout;
}

function ghJson(args) {
  const out = gh(args).trim();
  return out ? JSON.parse(out) : [];
}

function isQaReport(body) {
  return (body ?? '').trimStart().startsWith(QA_MARKER);
}

function isPerson(user) {
  return user?.type === 'User';
}

function minutesBetween(startIso, endIso) {
  if (!startIso || !endIso) {
    return null;
  }
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return null;
  }
  return Math.round(ms / 60_000);
}

function formatMinutes(value) {
  return value === null || value === undefined ? '—' : String(value);
}

function pct(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return (100 * numerator) / denominator;
}

function formatPct(value) {
  if (value === null || value === undefined) {
    return 'n/a';
  }
  return `${value.toFixed(1)}%`;
}

function issueLinksToPr(body, prNumber, prUrl) {
  const text = body ?? '';
  if (prUrl && text.includes(prUrl)) {
    return true;
  }
  return new RegExp(`/pull/${prNumber}\\b`).test(text);
}

function loadComments(repo, prNumber) {
  return ghJson(['api', `repos/${repo}/issues/${prNumber}/comments`, '--paginate']);
}

function parsePlanReview(comments) {
  let last = null;
  for (const comment of comments) {
    if (!isPerson(comment.user)) {
      continue;
    }
    const match = PLAN_REVIEW_RE.exec(comment.body ?? '');
    if (match) {
      last = {
        right: Number.parseInt(match[1], 10),
        reviewed: Number.parseInt(match[2], 10),
      };
    }
  }
  return last;
}

function parseTiming(comments, prCreatedAt) {
  let firstPlanAt = null;
  let firstQaAt = null;
  for (const comment of comments) {
    const body = comment.body ?? '';
    const login = comment.user?.login ?? '';
    if (login === BOT_LOGIN) {
      if (!firstPlanAt && !isQaReport(body)) {
        firstPlanAt = comment.created_at;
      }
    }
    if (!firstQaAt && isQaReport(body)) {
      firstQaAt = comment.created_at;
    }
  }
  return {
    minToPlan: minutesBetween(prCreatedAt, firstPlanAt),
    minToQa: minutesBetween(prCreatedAt, firstQaAt),
  };
}

function agentMinutesForBranch(branch) {
  const runs = ghJson([
    'run',
    'list',
    '--workflow',
    WORKFLOW,
    '--branch',
    branch,
    '--json',
    'status,createdAt,updatedAt',
    '--limit',
    '200',
  ]);
  let totalMs = 0;
  for (const run of runs) {
    if (run.status !== 'completed') {
      continue;
    }
    const ms = new Date(run.updatedAt).getTime() - new Date(run.createdAt).getTime();
    if (Number.isFinite(ms) && ms > 0) {
      totalMs += ms;
    }
  }
  return Math.round(totalMs / 60_000);
}

function countFindings(issues, prNumber, prUrl) {
  const linked = issues.filter((issue) => issueLinksToPr(issue.body, prNumber, prUrl));
  const falseAlarms = linked.filter(
    (issue) => issue.state === 'CLOSED' && issue.stateReason === 'NOT_PLANNED',
  );
  return { findings: linked.length, falseAlarms: falseAlarms.length };
}

function escapeCell(text) {
  return String(text).replace(/\|/g, '\\|');
}

function buildDoc(rows, totals, generatedAt) {
  const { sumRight, sumReviewed, sumFindings, sumFalseAlarms } = totals;
  const routing = formatPct(pct(sumRight, sumReviewed));
  const falseRate = formatPct(pct(sumFalseAlarms, sumFindings));

  let md = '';
  md += '# QA metrics\n\n';
  md += `Generated: ${generatedAt}\n\n`;
  md += `**Totals:** Routing accuracy: ${routing} (${sumRight}/${sumReviewed} rows); false-alarm rate: ${falseRate} (${sumFalseAlarms}/${sumFindings} findings).\n\n`;
  md += '| PR | Rows right | Rows reviewed | Min to plan | Min to QA report | Agent min | Findings | False alarms |\n';
  md += '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n';
  for (const row of rows) {
    md += `| [${escapeCell(row.title)}](${row.url}) (#${row.number}) | ${row.rowsRight ?? '—'} | ${row.rowsReviewed ?? '—'} | ${formatMinutes(row.minToPlan)} | ${formatMinutes(row.minToQa)} | ${row.agentMin} | ${row.findings} | ${row.falseAlarms} |\n`;
  }
  md += '\n';
  md += '## How each number is measured\n\n';
  md += '- **Rows right / rows reviewed:** Parsed from the latest human PR comment whose body starts with `Plan review: N/M`.\n';
  md += '- **Min to plan:** Minutes from PR `createdAt` to the first `github-actions[bot]` issue comment that is not a QA report (`<!-- fernly-qa-report -->`).\n';
  md += '- **Min to QA report:** Minutes from PR `createdAt` to the first issue comment whose body is a QA report (`<!-- fernly-qa-report -->`).\n';
  md += '- **Agent min:** Sum of wall-clock minutes (`updatedAt − createdAt`) for **completed** `pr-triage.yml` workflow runs on the PR head branch.\n';
  md += '- **Findings:** Open or closed issues labeled `qa-finding` whose body links to the PR (same `pull/N` URL).\n';
  md += '- **False alarms:** Those findings closed with GitHub state reason **Not planned** (`NOT_PLANNED`).\n';
  md += '- **Routing accuracy:** Σ rows right ÷ Σ rows reviewed across all `plan-approved` pull requests.\n';
  md += '- **False-alarm rate:** Σ false alarms ÷ Σ findings.\n\n';
  md += '## Cost\n\n';
  md += 'Agent spend is not available in GitHub. See the [Cursor dashboard](https://cursor.com/dashboard) for usage and billing.\n';
  return md;
}

function main() {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  const prs = ghJson([
    'pr',
    'list',
    '--label',
    'plan-approved',
    '--state',
    'all',
    '--json',
    'number,title,headRefName,createdAt,url',
    '--limit',
    '200',
  ]);
  const qaIssues = ghJson([
    'issue',
    'list',
    '--repo',
    repo,
    '--label',
    'qa-finding',
    '--state',
    'all',
    '--json',
    'number,body,state,stateReason',
    '--limit',
    '500',
  ]);

  const rows = [];
  let sumRight = 0;
  let sumReviewed = 0;
  let sumFindings = 0;
  let sumFalseAlarms = 0;

  for (const pr of prs) {
    const comments = loadComments(repo, pr.number);
    const plan = parsePlanReview(comments);
    const timing = parseTiming(comments, pr.createdAt);
    const agentMin = agentMinutesForBranch(pr.headRefName);
    const { findings, falseAlarms } = countFindings(qaIssues, pr.number, pr.url);

    if (plan) {
      sumRight += plan.right;
      sumReviewed += plan.reviewed;
    }
    sumFindings += findings;
    sumFalseAlarms += falseAlarms;

    rows.push({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      rowsRight: plan?.right ?? null,
      rowsReviewed: plan?.reviewed ?? null,
      minToPlan: timing.minToPlan,
      minToQa: timing.minToQa,
      agentMin,
      findings,
      falseAlarms,
    });
  }

  rows.sort((a, b) => a.number - b.number);

  const generatedAt = new Date().toISOString();
  const md = buildDoc(rows, { sumRight, sumReviewed, sumFindings, sumFalseAlarms }, generatedAt);
  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, md, 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);
}

main();
