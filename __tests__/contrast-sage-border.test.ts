// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const SCRIPT = path.join(process.cwd(), 'scripts/gates/contrast-check.ts');
const THEME = path.join(process.cwd(), 'app/css/theme.css');
const LABEL = 'border sage-300 on surface-raised (non-text)';
const SAGE_300 = /--color-sage-300:\s*#[0-9a-fA-F]{3,8};/;

describe('sage-300 border on surface-raised (WCAG 1.4.11)', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sage-border-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes on the shipped theme and reports the pair at 3:1', () => {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`PASS ${LABEL}`);
    expect(result.stdout).toContain('(min 3:1)');
  });

  it('fails when the token is lowered below 3:1', () => {
    const theme = path.join(dir, 'theme.css');
    writeFileSync(
      theme,
      readFileSync(THEME, 'utf8').replace(SAGE_300, '--color-sage-300: #1a1a1a;'),
    );
    const result = spawnSync('node', [SCRIPT, theme], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`FAIL ${LABEL}`);
  });
});
