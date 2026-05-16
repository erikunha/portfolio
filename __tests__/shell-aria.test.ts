import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = readFileSync(
  path.resolve(__dirname, '../components/client/InteractiveShell.tsx'),
  'utf-8',
);

describe('shell feed accessibility', () => {
  it('shell feed has aria-label', () => {
    expect(shell).toContain('aria-label="shell output"');
  });

  it('LoadingDots is aria-hidden', () => {
    expect(shell).toMatch(/LoadingDots[\s\S]{0,300}aria-hidden/);
  });

  it('feed has aria-busy attribute when loading', () => {
    expect(shell).toContain('aria-busy');
  });
});
