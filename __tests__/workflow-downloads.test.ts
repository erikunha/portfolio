import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), '.github/workflows');
const workflows = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));

describe('workflow downloads survive a transient release-host error', () => {
  for (const name of workflows) {
    const lines = readFileSync(join(dir, name), 'utf8').split('\n');
    const downloads = lines
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /\bcurl\b/.test(line) && /\s-[A-Za-z]*o\s|--output\b/.test(line));
    for (const { line, number } of downloads) {
      it(`${name}:${number} retries the download`, () => {
        expect(
          line,
          'a curl download with no --retry turns one 504 from the release host into a red required job',
        ).toMatch(/--retry\s+\d+/);
      });
    }
  }
});
