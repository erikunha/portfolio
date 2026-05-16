import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APPSHELL = readFileSync(
  path.resolve(__dirname, '../components/AppShell.client.tsx'),
  'utf-8',
);
const PAGE = readFileSync(path.resolve(__dirname, '../app/page.tsx'), 'utf-8');

describe('skip-to-content link', () => {
  it('AppShell renders a skip-to-content element', () => {
    expect(APPSHELL).toContain('skip-to-content');
  });

  it('skip link targets #main-content', () => {
    expect(APPSHELL).toContain('#main-content');
  });

  it('skip link text describes its purpose', () => {
    expect(APPSHELL).toMatch(/[Ss]kip to (main )?content/);
  });

  it('page main element has id="main-content"', () => {
    expect(PAGE).toContain('main-content');
  });
});
