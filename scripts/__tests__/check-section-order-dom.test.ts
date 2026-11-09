import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'check-section-order.mjs');
const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

function runAgainst(css: string) {
  const root = mkdtempSync(join(tmpdir(), 'section-order-dom-'));
  try {
    mkdirSync(join(root, 'components', 'sections'), { recursive: true });
    mkdirSync(join(root, 'app', 'css'), { recursive: true });
    writeFileSync(
      join(root, 'components', 'sections', 'Alpha.tsx'),
      '<section id="sec-alpha" /><section id="sec-beta" />',
    );
    writeFileSync(join(root, 'app', 'css', 'base.css'), css);
    return spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('check-section-order keeps the visual order equal to the DOM order', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it('fails when a section rule reorders it with the CSS order property', () => {
    const result = runAgainst('@media (max-width: 767.98px) { #sec-alpha { order: 2; } }');

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/sec-alpha/);
    expect(result.stderr).toMatch(/DOM order/);
  });

  it('passes when no section rule declares an order', () => {
    const result = runAgainst('#sec-alpha { min-height: 0; } #sec-beta { min-height: 0; }');

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\[check-section-order\] OK/);
  });
});
