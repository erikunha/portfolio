import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(path.resolve(__dirname, '../lib/lighthouse-scores.ts'), 'utf-8');

describe('LIGHTHOUSE_FALLBACK', () => {
  it('does not use 100 as a fallback performance score', () => {
    expect(SOURCE).not.toMatch(/performance:\s*100/);
  });

  it('does not use 100 as a fallback accessibility score', () => {
    expect(SOURCE).not.toMatch(/accessibility:\s*100/);
  });

  it('marks the fallback as unavailable via fetchedAt sentinel', () => {
    expect(SOURCE).toMatch(/fetchedAt:\s*'—'/);
  });

  it('does not use 100 as a fallback seo score', () => {
    expect(SOURCE).not.toMatch(/seo:\s*100/);
  });

  it('does not use 98 as a fallback bestPractices score', () => {
    expect(SOURCE).not.toMatch(/bestPractices:\s*98/);
  });
});
