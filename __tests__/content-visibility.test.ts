import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(path.resolve(__dirname, '../app/css/_layout.css'), 'utf-8');

describe('content-visibility', () => {
  it('.module--desktop has content-visibility: auto', () => {
    expect(layout).toContain('content-visibility');
  });
});
