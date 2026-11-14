import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const SCRIPT = join(process.cwd(), 'scripts/check-no-dashes.mjs');
const EM_DASH = String.fromCodePoint(0x2014);
const GENERATED_HEADING = '## This is NOT the Next.js you know';
const GENERATED_END = '<!-- END:nextjs-agent-rules -->';

function runOn(files: Record<string, string>): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'nodashes-bounds-'));
  execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
    execFileSync('git', ['add', name], { cwd: dir, stdio: 'ignore' });
  }
  try {
    return { code: 0, out: execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' }) };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe('check-no-dashes bounds', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('fails when it scanned no tracked file, instead of passing with no coverage', () => {
    const r = runOn({});
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/no tracked file/);
  });

  it('checks text written after the end of the generated AGENTS.md block', () => {
    const agents = [
      '# Agents',
      GENERATED_HEADING,
      `generated ${EM_DASH} text`,
      GENERATED_END,
      `## Hand written ${EM_DASH} later`,
      '',
    ].join('\n');
    const r = runOn({ 'AGENTS.md': agents });
    expect(r.code).toBe(1);
    expect(r.out).toContain('AGENTS.md:5');
    expect(r.out).not.toContain('AGENTS.md:3');
  });
});
