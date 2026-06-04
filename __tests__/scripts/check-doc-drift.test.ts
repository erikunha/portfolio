import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// WS6: scripts/check-doc-drift.mjs is the CI gate that keeps the ARCHITECTURE.md
// directory tree honest — every path it references must exist on disk. The gate
// is black-box tested (spawn the script, assert exit code + output), matching
// the repo's behavioral-assertion standard (no source-grep, no internal import).
//
// Failure-mode coverage (thinking-inversion pass — each case is one bug class
// the parser must not fall into):
//  1. comment tokens after `#` must NOT be checked as paths
//  2. pure-comment and blank lines are skipped
//  3. trailing `,` / `/` on a token is normalized
//  4. a MISSING marker fails loud (exit 1) — never a vacuous pass (the WS0
//     false-green lesson: a gate that can't find its input must shout)
//  5. fence lines (```) inside the marked region are ignored
//  6. the live ARCHITECTURE.md has zero drift

const SCRIPT = join(process.cwd(), 'scripts/check-doc-drift.mjs');

const START = '<!-- doc-drift:start -->';
const END = '<!-- doc-drift:end -->';

/** Wrap tree lines in a fenced, marker-bounded block (the real doc shape). */
function doc(lines: string[], { startMarker = START, endMarker = END } = {}): string {
  return [
    '# Architecture',
    'Some prose.',
    startMarker,
    '```',
    ...lines,
    '```',
    endMarker,
    'Trailing prose.',
  ].join('\n');
}

/** Materialize a temp repo, write the markdown, run the gate against it. */
function runOn(markdown: string, files: string[] = []): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'docdrift-'));
  for (const f of files) {
    if (f.endsWith('/')) {
      mkdirSync(join(dir, f), { recursive: true });
    } else {
      const full = join(dir, f);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, '');
    }
  }
  const mdPath = join(dir, 'ARCHITECTURE.md');
  writeFileSync(mdPath, markdown);
  try {
    const out = execFileSync('node', [SCRIPT, mdPath], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe('check-doc-drift', () => {
  it('passes when every referenced path exists', () => {
    const r = runOn(doc(['app/page.tsx', 'lib/env.ts', 'content/']), [
      'app/page.tsx',
      'lib/env.ts',
      'content/',
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/0 stale|0 drift/i);
  });

  it('fails and names a stale path that no longer exists', () => {
    const r = runOn(doc(['app/page.tsx', 'components/ghost.tsx']), ['app/page.tsx']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('components/ghost.tsx');
  });

  it('ignores tokens that appear only in a # comment annotation', () => {
    // The annotation mentions a path that does NOT exist; it must not be checked.
    const r = runOn(doc(['app/page.tsx  # see components/ghost.tsx for the island']), [
      'app/page.tsx',
    ]);
    expect(r.code).toBe(0);
  });

  it('skips pure-comment lines and blank lines', () => {
    const r = runOn(
      doc(['# --- app ---', '', 'app/page.tsx', '   ', '# --- lib ---', 'lib/env.ts']),
      ['app/page.tsx', 'lib/env.ts'],
    );
    expect(r.code).toBe(0);
  });

  it('normalizes a trailing comma or slash on a token', () => {
    const r = runOn(doc(['lib/server/,', 'app/css/']), ['lib/server/', 'app/css/']);
    expect(r.code).toBe(0);
  });

  it('fails loud when the start marker is absent (never a vacuous pass)', () => {
    // No start marker: even though no bad paths exist, the gate must refuse to
    // run rather than silently report success.
    const md = ['# Architecture', '```', 'app/ghost.tsx', '```', END].join('\n');
    const r = runOn(md, []);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/marker/i);
  });

  it('fails loud when the end marker is absent', () => {
    const md = [START, '```', 'app/page.tsx', '```'].join('\n');
    const r = runOn(md, ['app/page.tsx']);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/marker/i);
  });

  it('ignores the ``` fence lines inside the marked region', () => {
    // The fence lines themselves are not paths; only real entries are checked.
    const r = runOn(doc(['app/page.tsx']), ['app/page.tsx']);
    expect(r.code).toBe(0);
  });

  it('the live ARCHITECTURE.md references only paths that exist', () => {
    // Default arg = ARCHITECTURE.md, resolved against repo root (vitest cwd).
    let code = 0;
    let out = '';
    try {
      out = execFileSync('node', [SCRIPT], { encoding: 'utf8', cwd: process.cwd() });
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string };
      code = err.status;
      out = `${err.stdout}${err.stderr}`;
    }
    expect(code, out).toBe(0);
  });
});
