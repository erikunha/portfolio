// scripts/__tests__/detect-changes.parity.test.ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Use resolve(process.cwd(), ...) instead of new URL(...).pathname because Vitest's
// import.meta.url resolves to the compiled output path, not the source tree, causing
// the runner to be unfindable. process.cwd() is the repo root in Vitest's environment.
const runner = resolve(process.cwd(), 'scripts/detect-changes.mjs');

let repo: string;
const git = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const write = (rel: string, body: string) => {
  const abs = join(repo, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
};

// Seed the BASE tree, commit; apply `mutate`, commit HEAD; run the runner; parse.
function runScenario(seed: () => void, mutate: () => void) {
  seed();
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  const base = git(['rev-parse', 'HEAD']).trim();
  mutate();
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'head']);
  const head = git(['rev-parse', 'HEAD']).trim();
  const out = join(repo, 'gh_output');
  writeFileSync(out, '');
  execFileSync('node', [runner], {
    cwd: repo,
    env: {
      ...process.env,
      EVENT_NAME: 'pull_request',
      BASE_SHA: base,
      HEAD_SHA: head,
      GITHUB_OUTPUT: out,
    },
  });
  const text = readFileSync(out, 'utf8');
  const get = (k: string) =>
    /true|false/.exec(text.split('\n').find((l) => l.startsWith(`${k}=`)) ?? '')?.[0];
  return { ai: get('ai'), app: get('app'), ui: get('ui') };
}

const PKG = (extra: object = {}) =>
  JSON.stringify({ name: 'x', version: '1.0.0', browserslist: ['chrome >= 95'], ...extra });

describe('detect-changes parity (real git)', () => {
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'dc-parity-'));
    git(['init', '-q']);
    git(['config', 'user.email', 't@t']);
    git(['config', 'user.name', 't']);
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  const baseSeed = () => {
    write('package.json', PKG());
    write('app/page.tsx', 'export default () => null;\n');
    write('lib/eval/x.ts', 'export const x = 1;\n');
    write('README.md', 'hi\n');
  };

  it('row 5: lib/eval-only change -> ui suppressed by exclude', () => {
    expect(runScenario(baseSeed, () => write('lib/eval/x.ts', 'export const x = 2;\n'))).toEqual({
      ai: 'true',
      app: 'true',
      ui: 'false',
    });
  });

  it('row 6: lib/eval + app change -> ui stays true (exclude does not suppress)', () => {
    expect(
      runScenario(baseSeed, () => {
        write('lib/eval/x.ts', 'export const x = 2;\n');
        write('app/page.tsx', 'export default () => null; // edit\n');
      }),
    ).toEqual({ ai: 'true', app: 'true', ui: 'true' });
  });

  it('row 7: browserslist bump (no other diff) -> ui re-armed via render slice', () => {
    expect(
      runScenario(baseSeed, () => write('package.json', PKG({ browserslist: ['chrome >= 96'] }))),
    ).toEqual({ ai: 'false', app: 'true', ui: 'true' });
  });

  it('row 8: pnpm.overrides bump (no lock diff) -> ui re-armed via render slice', () => {
    expect(
      runScenario(baseSeed, () =>
        write('package.json', PKG({ pnpm: { overrides: { zod: '4.4.3' } } })),
      ),
    ).toEqual({ ai: 'false', app: 'true', ui: 'true' });
  });

  it('row 9: package.json absent at BASE (added) -> null fallback, no throw', () => {
    const seedNoPkg = () => {
      write('app/page.tsx', 'export default () => null;\n');
      write('README.md', 'hi\n');
    };
    expect(runScenario(seedNoPkg, () => write('package.json', PKG()))).toEqual({
      ai: 'false',
      app: 'true',
      ui: 'true',
    });
  });

  it('row 10: lighthouserc.json only -> app yes, ui no (app-minus-ui member)', () => {
    expect(
      runScenario(
        () => {
          baseSeed();
          write('lighthouserc.json', '{}\n');
        },
        () => write('lighthouserc.json', '{ "x": 1 }\n'),
      ),
    ).toEqual({ ai: 'false', app: 'true', ui: 'false' });
  });

  it('row 11: docs-only -> all false', () => {
    expect(runScenario(baseSeed, () => write('README.md', 'bye\n'))).toEqual({
      ai: 'false',
      app: 'false',
      ui: 'false',
    });
  });
});
