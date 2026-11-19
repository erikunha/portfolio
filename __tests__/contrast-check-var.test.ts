import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

const SCRIPT = join(process.cwd(), 'scripts/gates/contrast-check.ts');

const PALETTE = `
  --color-secondary-950: #000000;
  --color-secondary-900: #000000;
  --color-secondary-200: #e6ffe6;
  --color-tertiary-50: #e6ffe6;
  --color-tertiary-400: #e6ffe6;
  --color-tertiary-500: #e6ffe6;
  --color-senary-300: #e6ffe6;
  --color-signal-500: #00ff41;
  --color-signal-400: #e6ffe6;
  --color-signal-700: #e6ffe6;
  --color-signal-300: #e6ffe6;
  --color-text-secondary: #e6ffe6;
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'contrast-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const run = (aliases: string) => {
  const theme = join(dir, 'theme.css');
  writeFileSync(theme, `@theme {\n${PALETTE}\n${aliases}\n}\n`);
  return spawnSync('node', [SCRIPT, theme], { encoding: 'utf8' });
};

describe('contrast-check theme parsing', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('resolves a color alias that points at another color token', () => {
    const result = run('--color-text: var(--color-tertiary-50);');
    expect(result.stderr).not.toContain('Cannot parse');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Contrast check passed.');
  });

  it('fails an alias whose target is missing', () => {
    const result = run('--color-text: var(--color-missing);');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Cannot parse --color-text');
  });
});
