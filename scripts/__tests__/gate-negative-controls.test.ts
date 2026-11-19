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

const WALK_HELPER = 'scripts/lib/walk.ts';

function install(script: string): string {
  mkdirSync(join(sandbox, 'scripts/gates'), { recursive: true });
  mkdirSync(join(sandbox, 'scripts/lib'), { recursive: true });
  copyFileSync(join(REPO, WALK_HELPER), join(sandbox, WALK_HELPER));
  copyFileSync(join(REPO, 'scripts/gates', script), join(sandbox, 'scripts/gates', script));
  return join(sandbox, 'scripts/gates', script);
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
    const script = install('check-client-naming.ts');
    write('components/Widget.tsx', USE_CLIENT);
    const { code, output } = run(script);
    expect(code).toBe(FAIL);
    expect(output).toContain('components/Widget.tsx');
  });

  it('passes the same file once it is named *.client.tsx', () => {
    const script = install('check-client-naming.ts');
    write('components/Widget.client.tsx', USE_CLIENT);
    expect(run(script).code).toBe(PASS);
  });

  it('downgrades to a warning only when the lenient switch is set', () => {
    const script = install('check-client-naming.ts');
    write('lib/state.ts', USE_CLIENT);
    expect(run(script).code).toBe(FAIL);
    expect(run(script, { CHECK_CLIENT_NAMING_LENIENT: '1' }).code).toBe(PASS);
  });
});

describe('check-component-docs-coverage', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const INDEX_PAGE = 'app/(en)/design-system/components/page.mdx';
  const PROPS_TABLE =
    '| Prop | Type | Default | Required |\n|---|---|---|---|\n| `a` | `string` | none | no |\n';
  const primitivePage = (slug: string): string =>
    `app/(en)/design-system/primitives/${slug}/page.mdx`;

  function component(name: string): void {
    mkdirSync(join(sandbox, 'design-system/components', name), { recursive: true });
  }

  function indexLinking(...slugs: string[]): string {
    return slugs.map((slug) => `[x](/design-system/primitives/${slug})\n`).join('');
  }

  it('fails when a component has no primitive page', () => {
    const script = install('check-component-docs-coverage.ts');
    component('Alpha');
    component('Beta');
    write(primitivePage('alpha'), PROPS_TABLE);
    write(INDEX_PAGE, indexLinking('alpha', 'beta'));
    const { code, output } = run(script);
    expect(code).toBe(FAIL);
    expect(output).toContain('MISSING PAGE: Beta');
    expect(output).not.toContain('Alpha');
  });

  it('fails when a primitive page has no props table', () => {
    const script = install('check-component-docs-coverage.ts');
    component('Alpha');
    write(primitivePage('alpha'), '# ALPHA\n');
    write(INDEX_PAGE, indexLinking('alpha'));
    const { code, output } = run(script);
    expect(code).toBe(FAIL);
    expect(output).toContain('MISSING PROPS TABLE: Alpha');
  });

  it('fails when the components index does not link a primitive page', () => {
    const script = install('check-component-docs-coverage.ts');
    component('Alpha');
    write(primitivePage('alpha'), PROPS_TABLE);
    write(INDEX_PAGE, '# COMPONENTS\n');
    const { code, output } = run(script);
    expect(code).toBe(FAIL);
    expect(output).toContain('MISSING INDEX LINK: Alpha');
  });

  it('maps a PascalCase component to its kebab-case page', () => {
    const script = install('check-component-docs-coverage.ts');
    component('NavItem');
    write(primitivePage('nav-item'), PROPS_TABLE);
    write(INDEX_PAGE, indexLinking('nav-item'));
    expect(run(script).code).toBe(PASS);
  });

  it('does not take a link that only starts with the primitive slug', () => {
    const script = install('check-component-docs-coverage.ts');
    component('Nav');
    write(primitivePage('nav'), PROPS_TABLE);
    write(INDEX_PAGE, indexLinking('nav-item'));
    expect(run(script).code).toBe(FAIL);
  });

  it('passes when every component has its page, table and index link', () => {
    const script = install('check-component-docs-coverage.ts');
    component('Alpha');
    write(primitivePage('alpha'), PROPS_TABLE);
    write(INDEX_PAGE, indexLinking('alpha'));
    expect(run(script).code).toBe(PASS);
  });
});

describe('check-harness-size', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const LIMITS = JSON.stringify({ 'AGENTS.md': { maxLines: 5 } });

  function seed(lines: number): string {
    const script = install('check-harness-size.ts');
    write('scripts/gates/harness-size.json', LIMITS);
    write('AGENTS.md', `${'rule\n'.repeat(lines)}`);
    return script;
  }

  it('fails when a limited file is over its line cap', () => {
    const { code, output } = run(seed(20));
    expect(code).toBe(FAIL);
    expect(output).toContain('AGENTS.md');
  });

  it('fails when a limited file is missing, never reading absence as small', () => {
    const script = install('check-harness-size.ts');
    write('scripts/gates/harness-size.json', LIMITS);
    expect(run(script).code).toBe(FAIL);
  });

  it('passes a file within its cap', () => {
    expect(run(seed(2)).code).toBe(PASS);
  });
});
