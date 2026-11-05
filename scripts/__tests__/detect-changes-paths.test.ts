import { describe, expect, it } from 'vitest';
import { AI_PATHS, APP_PATHS, UI_PATHS } from '../detect-changes-paths.mjs';

describe('detect-changes manifest', () => {
  it('exports non-empty path arrays (anti-vacuous)', () => {
    expect(AI_PATHS.length).toBeGreaterThan(0);
    expect(APP_PATHS.length).toBeGreaterThan(0);
    expect(UI_PATHS.length).toBeGreaterThan(0);
  });

  it('keeps the load-bearing anchor pathspecs (guards against a truncated copy)', () => {
    expect(AI_PATHS).toContain('lib/eval/');
    expect(AI_PATHS).toContain('__tests__/ask-*');
    expect(APP_PATHS).toContain('.github/workflows/');
    expect(APP_PATHS).toContain('package.json');
    expect(UI_PATHS).toContain(':(exclude)lib/eval/**');
    expect(UI_PATHS).toContain(':(exclude)lib/__tests__/**');
  });

  it('arms the browser jobs when only a Playwright spec or baseline changes', () => {
    expect(
      APP_PATHS,
      'a tests/ change must arm e2e-functional, or a spec-only PR merges with its own spec never run',
    ).toContain('tests/');
    expect(
      UI_PATHS,
      'a tests/visual/ change must arm e2e-visual, or a baseline-only PR merges unchecked',
    ).toContain('tests/visual/');
  });

  it('keeps ui a subset of app for the literal (non-exclude, non-pkg) entries', () => {
    const literal = (xs: readonly string[]) =>
      xs.filter((p) => !p.startsWith(':(exclude)') && p !== 'package.json');
    for (const p of literal(UI_PATHS)) expect(APP_PATHS).toContain(p);
  });
});
