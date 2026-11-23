import fs from 'node:fs';
import path from 'node:path';

export type HelperTier = 'a' | 'b' | 'c';

export interface ManifestEntry {
  tier: HelperTier;
  scenario: string;
  example: string;
  then: string;
  result: 'pass' | 'fail' | 'judge';
  passRate?: string;
  evidence?: string;
}

function safeFileName(title: string): string {
  return title.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function writeEntries(tier: HelperTier, testTitle: string, entries: ManifestEntry[]): void {
  const folder = path.join(process.cwd(), 'helper-results', `tier-${tier}`);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${safeFileName(testTitle)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}