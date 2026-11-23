import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const resultsRoot = path.join(root, 'helper-results');
const tiers = ['a', 'b', 'c'];

function phraseOf(example) {
  const match = String(example).match(/^I ask the helper "(.*)"$/s);
  return match ? match[1] : String(example);
}

function readTier(tier) {
  const folder = path.join(resultsRoot, `tier-${tier}`);
  if (!fs.existsSync(folder)) return [];
  const files = fs.readdirSync(folder).filter((name) => name.endsWith('.json')).sort();
  const entries = [];
  for (const name of files) {
    const text = fs.readFileSync(path.join(folder, name), 'utf8').replace(/^\uFEFF/, '');
    const raw = JSON.parse(text);
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      if (!['pass', 'fail', 'judge'].includes(entry.result)) continue;
      if (!entry.scenario || !entry.example || !entry.then) continue;
      entries.push(entry);
    }
  }
  return entries;
}

function checkedResult(entry) {
  if (!entry || entry.result === 'judge') return null;
  return entry.result;
}

function cell(entry, tier) {
  const result = checkedResult(entry);
  if (!result) return '—';
  if (tier === 'b' && entry.passRate) return `${result} (${entry.passRate})`;
  return result;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

const rows = new Map();

for (const tier of tiers) {
  for (const entry of readTier(tier)) {
    const key = `${entry.scenario}\0${phraseOf(entry.example)}\0${entry.then}`;
    const row = rows.get(key) ?? {
      scenario: entry.scenario,
      example: phraseOf(entry.example),
      then: entry.then,
      byTier: {},
    };
    const previous = row.byTier[tier];
    if (!previous) {
      row.byTier[tier] = entry;
    } else if (previous.result !== 'fail' && entry.result === 'fail') {
      row.byTier[tier] = entry;
    } else if (previous.result === 'judge' && entry.result !== 'judge') {
      row.byTier[tier] = entry;
    }
    rows.set(key, row);
  }
}

const table = [...rows.values()].map((row) => {
  const verdicts = tiers.map((tier) => checkedResult(row.byTier[tier])).filter(Boolean);
  const disagree = verdicts.length >= 2 && new Set(verdicts).size > 1;
  return { ...row, disagree };
});

const lines = [
  '# Helper results',
  '',
  '| Scenario | Example | Then | A | B | C | Disagree |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];

for (const row of table) {
  lines.push(
    `| ${[
      row.scenario,
      row.example,
      row.then,
      cell(row.byTier.a, 'a'),
      cell(row.byTier.b, 'b'),
      cell(row.byTier.c, 'c'),
      row.disagree ? 'yes' : '',
    ]
      .map(escapeCell)
      .join(' | ')} |`,
  );
}

lines.push('', '## Failures', '');

const failures = [];
for (const row of table) {
  for (const tier of tiers) {
    const entry = row.byTier[tier];
    if (entry?.result === 'fail') failures.push({ row, tier, entry });
  }
}

if (failures.length === 0) {
  lines.push('None.');
} else {
  for (const { row, tier, entry } of failures) {
    const rate = tier === 'b' && entry.passRate ? ` (${entry.passRate})` : '';
    lines.push(`### ${tier.toUpperCase()}${rate} — ${row.scenario}`);
    lines.push('');
    lines.push(`**${row.example}** — ${row.then}`);
    lines.push('');
    lines.push(entry.evidence ? String(entry.evidence) : '_No evidence recorded._');
    lines.push('');
  }
}

fs.mkdirSync(resultsRoot, { recursive: true });
fs.writeFileSync(path.join(resultsRoot, 'report.md'), `${lines.join('\n')}\n`, 'utf8');

const disagreements = table.filter((row) => row.disagree);
console.log(`${table.length} rows, ${disagreements.length} disagree, ${failures.length} failures`);
for (const row of disagreements) {
  console.log(
    [
      row.example,
      row.then,
      `A=${cell(row.byTier.a, 'a')}`,
      `B=${cell(row.byTier.b, 'b')}`,
      `C=${cell(row.byTier.c, 'c')}`,
    ].join(' | '),
  );
}
