import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(path.resolve(__dirname, '../app/css/_layout.css'), 'utf-8');
const page = readFileSync(path.resolve(__dirname, '../app/page.tsx'), 'utf-8');

describe('content-visibility', () => {
  it('_layout.css defines .cv-defer with content-visibility: auto', () => {
    expect(layout).toContain('content-visibility: auto');
    expect(layout).toContain('.cv-defer');
  });

  it('does not use positional nth-of-type for below-fold deferral', () => {
    // Class-based selection (.cv-defer) replaced the nth-of-type positional
    // selector — positional approach silently regresses on markup reorderings.
    expect(layout).not.toMatch(/nth-of-type\(n\s*\+\s*\d+\)/);
  });

  it('page.tsx applies defer to at least 10 below-fold modules', () => {
    // Count occurrences of `defer />` or `defer\n` to verify coverage.
    // Threshold matches intent: Readme/Shell/ManPage/Now are above fold;
    // ProjectsSection through ContactSection (14 sections) are deferred.
    const deferMatches = (page.match(/\bdefer\b/g) ?? []).length;
    expect(deferMatches).toBeGreaterThanOrEqual(14);
  });
});
