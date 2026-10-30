import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-pre-pr.mjs');
const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

type Run = { code: number; out: string };

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(repo: string, relativePath: string, content: string): void {
  const full = join(repo, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commit(repo: string, message: string): string {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

function makeRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'prepr-'));
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 'gate@example.com']);
  git(repo, ['config', 'user.name', 'Gate']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  git(repo, ['config', 'core.hooksPath', join(repo, '.no-hooks')]);
  write(repo, 'README.md', `# Fixture\n\nA fixture ${EM_DASH} dash.\n`);
  write(repo, 'app/page.tsx', 'export const Page = () => null;\n');
  write(repo, 'lib/env.ts', 'export const ENV = "production";\n');
  write(repo, 'docs/guide.md', 'The runtime reads lib/env.ts for its settings.\n');
  commit(repo, 'chore: fixture base');
  git(repo, ['checkout', '-b', 'feature']);
  return repo;
}

function run(repo: string, env: Record<string, string> = {}): Run {
  try {
    const out = execFileSync('node', [SCRIPT], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, PR_BASE: 'main', ...env },
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe('check-pre-pr', () => {
  it('passes with no findings when the change is clean', () => {
    const repo = makeRepo();
    write(repo, 'app/page.tsx', 'export const Page = () => null;\nexport const extra = 1;\n');
    commit(repo, 'feat: add a value');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/no hard findings/i);
    expect(r.out).not.toMatch(/HARD/);
  });

  it('fails on a net-new em dash and names the file and line', () => {
    const repo = makeRepo();
    write(repo, 'README.md', `# Fixture\n\nA fixture ${EM_DASH} dash.\n\nA new ${EM_DASH} dash.\n`);
    commit(repo, 'docs: add prose');
    const r = run(repo);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/HARD dash README\.md:\d+/);
    expect(r.out).toMatch(/em dash/i);
  });

  it('fails on a net-new en dash', () => {
    const repo = makeRepo();
    write(repo, 'README.md', `# Fixture\n\nA fixture ${EM_DASH} dash.\n\nA new ${EN_DASH} dash.\n`);
    commit(repo, 'docs: add prose');
    const r = run(repo);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/HARD dash README\.md:\d+/);
    expect(r.out).toMatch(/en dash/i);
  });

  it('passes when the dash count does not increase', () => {
    const repo = makeRepo();
    write(repo, 'README.md', `# Fixture\n\nA fixture ${EM_DASH} dash, reworded.\n`);
    commit(repo, 'docs: reword prose');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/HARD dash/);
  });

  it('fails when a changed doc cites a SHA outside the branch history', () => {
    const repo = makeRepo();
    git(repo, ['checkout', '-b', 'other']);
    write(repo, 'app/other.ts', 'export const other = 1;\n');
    const orphan = commit(repo, 'chore: a commit outside the branch');
    git(repo, ['checkout', 'feature']);
    write(
      repo,
      'docs/guide.md',
      `The runtime reads lib/env.ts for its settings.\n\nSee ${orphan}.\n`,
    );
    commit(repo, 'docs: cite a commit');
    const r = run(repo);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/HARD stale-sha docs\/guide\.md:\d+/);
  });

  it('passes when a changed doc cites a SHA in the branch history', () => {
    const repo = makeRepo();
    const ancestor = git(repo, ['rev-parse', 'HEAD']);
    write(
      repo,
      'docs/guide.md',
      `The runtime reads lib/env.ts for its settings.\n\nSee ${ancestor}.\n`,
    );
    commit(repo, 'docs: cite a commit');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/HARD stale-sha/);
  });

  it('fails when a commit body cites a SHA outside the branch history', () => {
    const repo = makeRepo();
    git(repo, ['checkout', '-b', 'other']);
    write(repo, 'app/other.ts', 'export const other = 1;\n');
    const orphan = commit(repo, 'chore: a commit outside the branch');
    git(repo, ['checkout', 'feature']);
    write(repo, 'app/page.tsx', 'export const Page = () => null;\nexport const extra = 1;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-m', 'feat: add a value', '-m', `Reverts the change from ${orphan}.`]);
    const r = run(repo);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/HARD stale-sha commit [0-9a-f]+:\d+/);
  });

  it('fails when a changed doc names a path that does not exist', () => {
    const repo = makeRepo();
    write(
      repo,
      'docs/guide.md',
      'The runtime reads lib/env.ts for its settings.\n\nSee app/ghost.tsx.\n',
    );
    commit(repo, 'docs: name a path');
    const r = run(repo);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/HARD missing-path docs\/guide\.md:\d+/);
    expect(r.out).toMatch(/app\/ghost\.tsx/);
  });

  it('passes when a changed doc names a path that exists', () => {
    const repo = makeRepo();
    write(
      repo,
      'docs/guide.md',
      'The runtime reads lib/env.ts for its settings.\n\nSee app/page.tsx.\n',
    );
    commit(repo, 'docs: name a path');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/HARD missing-path/);
  });

  it('passes when a changed doc names a path that exists only in the working tree', () => {
    const repo = makeRepo();
    write(repo, 'app/pending.tsx', 'export const Pending = () => null;\n');
    write(
      repo,
      'docs/guide.md',
      'The runtime reads lib/env.ts for its settings.\n\nSee app/pending.tsx.\n',
    );
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/HARD missing-path/);
  });

  it('fails on an uncommitted change, because the working tree is in scope', () => {
    const repo = makeRepo();
    write(repo, 'README.md', `# Fixture\n\nA fixture ${EM_DASH} dash.\n\nA new ${EM_DASH} dash.\n`);
    const r = run(repo);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/HARD dash README\.md:\d+/);
  });

  it('warns when the same number literal is added in two changed source files', () => {
    const repo = makeRepo();
    write(repo, 'lib/env.ts', 'export const ENV = "production";\nexport const LIMIT = 42;\n');
    write(repo, 'app/page.tsx', 'export const Page = () => null;\nexport const LIMIT = 42;\n');
    commit(repo, 'feat: add a limit');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/WARN duplicate-literal/);
    expect(r.out).toMatch(/42/);
  });

  it('warns when the repeated number is bound to a local const in both files', () => {
    const repo = makeRepo();
    write(repo, 'lib/env.ts', 'export const ENV = "production";\nconst RETRY_LIMIT = 42;\n');
    write(repo, 'app/page.tsx', 'export const Page = () => null;\nconst RETRY_LIMIT = 42;\n');
    commit(repo, 'feat: add a limit');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/WARN duplicate-literal/);
    expect(r.out).toMatch(/42/);
  });

  it('does not warn when the repeated number is an array index', () => {
    const repo = makeRepo();
    write(
      repo,
      'lib/env.ts',
      'export const ENV = "production";\nexport const A = process.argv[2];\n',
    );
    write(
      repo,
      'app/page.tsx',
      'export const Page = () => null;\nexport const A = process.argv[2];\n',
    );
    commit(repo, 'feat: add an index');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/WARN duplicate-literal/);
  });

  it('warns without failing when an unchanged doc mentions a changed path', () => {
    const repo = makeRepo();
    write(repo, 'lib/env.ts', 'export const ENV = "staging";\n');
    commit(repo, 'chore: change the env');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/WARN doc-drift docs\/guide\.md:\d+/);
    expect(r.out).toMatch(/lib\/env\.ts/);
  });

  it('warns without failing when the same literal is added in two changed source files', () => {
    const repo = makeRepo();
    write(
      repo,
      'lib/env.ts',
      'export const ENV = "production";\nexport const RETRY = "retry-after-500";\n',
    );
    write(
      repo,
      'app/page.tsx',
      'export const Page = () => null;\nexport const RETRY = "retry-after-500";\n',
    );
    commit(repo, 'feat: add a retry marker');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/WARN duplicate-literal/);
    expect(r.out).toMatch(/retry-after-500/);
  });

  it('does not warn when a literal is added to a single source file', () => {
    const repo = makeRepo();
    write(
      repo,
      'lib/env.ts',
      'export const ENV = "production";\nexport const RETRY = "retry-after-500";\n',
    );
    commit(repo, 'feat: add a retry marker');
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/WARN duplicate-literal/);
  });

  it('skips when HEAD equals the base and the working tree is clean', () => {
    const repo = makeRepo();
    git(repo, ['checkout', 'main']);
    const r = run(repo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/skipped/i);
  });

  it('fails with a gate error when the base ref cannot be resolved', () => {
    const repo = makeRepo();
    const r = run(repo, { PR_BASE: 'origin/does-not-exist' });
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/GATE ERROR/i);
  });
});
