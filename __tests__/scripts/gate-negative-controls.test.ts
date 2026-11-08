import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

const REPO = process.cwd();
const PASS = 0;
const FAIL = 1;

let sandbox: string;

function write(rel: string, body: string): void {
  const abs = join(sandbox, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

function install(script: string): string {
  mkdirSync(join(sandbox, 'scripts'), { recursive: true });
  copyFileSync(join(REPO, 'scripts', script), join(sandbox, 'scripts', script));
  return join(sandbox, 'scripts', script);
}

function run(script: string, env: Record<string, string> = {}) {
  const result = spawnSync('node', [script], {
    cwd: sandbox,
    encoding: 'utf8',
    env: { ...process.env, CHECK_CLIENT_NAMING_LENIENT: '', ...env },
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'gate-control-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('check-client-naming', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const USE_CLIENT = "'use client';\nexport const x = 1;\n";

  it('fails on a "use client" file whose name and folder do not mark it as client code', () => {
    const script = install('check-client-naming.mjs');
    write('components/Widget.tsx', USE_CLIENT);
    const { code, output } = run(script);
    expect(code).toBe(FAIL);
    expect(output).toContain('components/Widget.tsx');
  });

  it('passes the same file once it is named *.client.tsx', () => {
    const script = install('check-client-naming.mjs');
    write('components/Widget.client.tsx', USE_CLIENT);
    expect(run(script).code).toBe(PASS);
  });

  it('downgrades to a warning only when the lenient switch is set', () => {
    const script = install('check-client-naming.mjs');
    write('lib/state.ts', USE_CLIENT);
    expect(run(script).code).toBe(FAIL);
    expect(run(script, { CHECK_CLIENT_NAMING_LENIENT: '1' }).code).toBe(PASS);
  });
});

describe('check-component-docs-coverage', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const DOCS_PAGE = 'app/(en)/design-system/components/page.mdx';

  it('fails when a design-system component has no heading in the components page', () => {
    const script = install('check-component-docs-coverage.mjs');
    mkdirSync(join(sandbox, 'design-system/components/Alpha'), { recursive: true });
    mkdirSync(join(sandbox, 'design-system/components/Beta'), { recursive: true });
    write(DOCS_PAGE, '## Alpha\n');
    const { code, output } = run(script);
    expect(code).toBe(FAIL);
    expect(output).toContain('Beta');
    expect(output).not.toContain('MISSING DOCS: Alpha');
  });

  it('passes when every component has its heading', () => {
    const script = install('check-component-docs-coverage.mjs');
    mkdirSync(join(sandbox, 'design-system/components/Alpha'), { recursive: true });
    write(DOCS_PAGE, '## Alpha\n');
    expect(run(script).code).toBe(PASS);
  });
});

describe('check-harness-size', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const LIMITS = JSON.stringify({ 'AGENTS.md': { maxLines: 5 } });

  function seed(lines: number): string {
    const script = install('check-harness-size.mjs');
    write('scripts/harness-size.json', LIMITS);
    write('AGENTS.md', `${'rule\n'.repeat(lines)}`);
    return script;
  }

  it('fails when a limited file is over its line cap', () => {
    const { code, output } = run(seed(20));
    expect(code).toBe(FAIL);
    expect(output).toContain('AGENTS.md');
  });

  it('fails when a limited file is missing, never reading absence as small', () => {
    const script = install('check-harness-size.mjs');
    write('scripts/harness-size.json', LIMITS);
    expect(run(script).code).toBe(FAIL);
  });

  it('passes a file within its cap', () => {
    expect(run(seed(2)).code).toBe(PASS);
  });
});
