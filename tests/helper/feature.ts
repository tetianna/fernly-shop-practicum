import fs from 'node:fs';

export interface FeatureExample {
  scenario: string;
  when: string;
  thens: string[];
  row: Record<string, string>;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function fillPlaceholders(text: string, row: Record<string, string>): string {
  return text.replace(/<([^>]+)>/g, (_, key: string) => row[key] ?? `<${key}>`);
}

export function readFeature(path: string): FeatureExample[] {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const examples: FeatureExample[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const outline = line.match(/^\s*Scenario Outline:\s*(.+)\s*$/);
    if (!outline) {
      i += 1;
      continue;
    }

    const scenario = outline[1].trim();
    const whens: string[] = [];
    const thens: string[] = [];
    i += 1;

    while (i < lines.length) {
      const step = lines[i];
      if (/^\s*Examples:\s*$/.test(step)) break;
      if (/^\s*Scenario(?: Outline)?:/.test(step)) break;
      if (/^\s*Feature:/.test(step)) break;

      const when = step.match(/^\s*When\s+(.+)\s*$/);
      if (when) {
        whens.push(when[1].trim());
        i += 1;
        continue;
      }
      const then = step.match(/^\s*Then\s+(.+)\s*$/);
      if (then) {
        thens.push(then[1].trim());
        i += 1;
        continue;
      }
      if (step.trim() === '' || step.trim().startsWith('#')) {
        i += 1;
        continue;
      }
      i += 1;
    }

    if (i >= lines.length || !/^\s*Examples:\s*$/.test(lines[i])) {
      continue;
    }
    i += 1;

    const tableLines: string[] = [];
    while (i < lines.length) {
      const row = lines[i];
      if (row.trim() === '') break;
      if (/^\s*Scenario(?: Outline)?:/.test(row)) break;
      if (row.trim().startsWith('|')) tableLines.push(row);
      i += 1;
    }

    if (tableLines.length < 2) continue;

    const headers = splitTableRow(tableLines[0]);
    for (let r = 1; r < tableLines.length; r += 1) {
      const cells = splitTableRow(tableLines[r]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? '';
      });

      const when = whens.map((w) => fillPlaceholders(w, row)).join(' ');
      const filledThens = thens.map((t) => fillPlaceholders(t, row));
      examples.push({ scenario, when, thens: filledThens, row });
    }
  }

  return examples;
}