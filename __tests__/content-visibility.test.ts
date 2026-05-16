import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(path.resolve(__dirname, '../app/css/_layout.css'), 'utf-8');

describe('content-visibility', () => {
  it('below-fold desktop modules have content-visibility: auto', () => {
    expect(layout).toContain('content-visibility: auto');
  });

  it('content-visibility is scoped to nth-of-type(n+6) to exclude near-viewport sections', () => {
    expect(layout).toMatch(/nth-of-type\(n\+[5-9]\)/);
  });
});
