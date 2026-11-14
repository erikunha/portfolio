import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const SCRIPT = join(process.cwd(), 'scripts/check-no-dashes.mjs');
const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);
const GENERATED_HEADING = '## This is NOT the Next.js you know';

type Fixture = Record<string, string | Buffer>;

function git(dir: string, args: string[]): void {
  execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
}

function runOn(files: Fixture, untracked: Fixture = {}): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'nodashes-'));
  git(dir, ['init', '-q']);
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
    git(dir, ['add', name]);
  }
  for (const [name, body] of Object.entries(untracked)) writeFileSync(join(dir, name), body);
  try {
    const out = execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe('check-no-dashes', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('passes a tree with no em or en dash', () => {
    const r = runOn({ 'a.md': 'plain, text: with a hyphen-ated word and 2-3 range\n' });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/0 violations/);
  });

  it('fails on an em dash and names the file and line', () => {
    const r = runOn({ 'notes.md': `line one\nsecond ${EM_DASH} line\n` });
    expect(r.code).toBe(1);
    expect(r.out).toContain('notes.md:2');
  });

  it('fails on an en dash', () => {
    const r = runOn({ 'range.ts': `const r = '1${EN_DASH}2';\n` });
    expect(r.code).toBe(1);
    expect(r.out).toContain('range.ts:1');
  });

  it('ignores an untracked file', () => {
    const r = runOn({ 'a.md': 'clean\n' }, { 'scratch.md': `dirty ${EM_DASH}\n` });
    expect(r.code).toBe(0);
  });

  it('skips binary files', () => {
    const r = runOn({ 'blob.bin': Buffer.from([0x00, 0xe2, 0x80, 0x94, 0x00]) });
    expect(r.code).toBe(0);
  });

  it('allows the generated block of AGENTS.md and nothing above it', () => {
    const generated = `${GENERATED_HEADING}\n\nbreaking changes ${EM_DASH} read the docs\n`;
    expect(runOn({ 'AGENTS.md': `# Agents\n\n${generated}` }).code).toBe(0);
    const above = runOn({ 'AGENTS.md': `# Agents ${EM_DASH} hand written\n\n${generated}` });
    expect(above.code).toBe(1);
    expect(above.out).toContain('AGENTS.md:1');
  });

  it('does not extend the AGENTS.md allowance to other files', () => {
    const r = runOn({ 'OTHER.md': `${GENERATED_HEADING}\n\nx ${EM_DASH} y\n` });
    expect(r.code).toBe(1);
    expect(r.out).toContain('OTHER.md:3');
  });
});
