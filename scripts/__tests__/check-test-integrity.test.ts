import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findViolations, scanRoot } from '../check-test-integrity';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

const SCRIPT = join(process.cwd(), 'scripts', 'check-test-integrity.ts');

function summarize(source: string, file = 'sample.test.ts') {
  return findViolations(source, file).map((v) => `${v.kind}@${v.line}`);
}

describe('focused tests', () => {
  it.each([
    ['it.only', "it.only('a', () => { expect(1).toBe(1); });"],
    ['test.only', "test.only('a', async () => { await expect(1).toBe(1); });"],
    ['describe.only', "describe.only('a', () => { it('b', () => { expect(1).toBe(1); }); });"],
    [
      'test.describe.only',
      "test.describe.only('a', () => { test('b', () => { expect(1).toBe(1); }); });",
    ],
    [
      'test.describe.serial.only',
      "test.describe.serial.only('a', () => { test('b', () => { expect(1).toBe(1); }); });",
    ],
    ['it.only.each', "it.only.each([1, 2])('a %d', (n) => { expect(n).toBeGreaterThan(0); });"],
    ['string element access', "test['only']('a', () => { expect(1).toBe(1); });"],
    [
      'string element access on a modifier chain',
      "test.describe['only']('a', () => { test('b', () => { expect(1).toBe(1); }); });",
    ],
    ['a cast callee', "(it as any).only('a', () => { expect(1).toBe(1); });"],
    ['a non-null callee', "it!.only('a', () => { expect(1).toBe(1); });"],
    ['a parenthesized callee', "(it).only('a', () => { expect(1).toBe(1); });"],
    ['a satisfies callee', "(it satisfies unknown).only('a', () => { expect(1).toBe(1); });"],
    ['a nested wrapper', "((it as any)!).only('a', () => { expect(1).toBe(1); });"],
  ])('flags %s once, on the line of the call', (_name, source) => {
    expect(summarize(`\n${source}`)).toEqual(['focused@2']);
  });

  it('does not treat a non-literal element access as a modifier', () => {
    const source = "it[name]('a', () => { expect(1).toBe(1); });";
    expect(summarize(source)).toEqual([]);
  });

  it('ignores an unrelated member called only', () => {
    const source = [
      "const picked = dataset.only('x');",
      "it('a', () => { expect(picked).toBe(1); });",
    ].join('\n');
    expect(summarize(source)).toEqual([]);
  });

  it('ignores the word in strings and comments', () => {
    const source = [
      "it('mentions it.only and test.skip(cond) in its title', () => {",
      "  expect('it.only(x)').toContain('only');",
      '});',
    ].join('\n');
    expect(summarize(source)).toEqual([]);
  });
});

describe('tests without an assertion', () => {
  it('flags an empty body and a body that only acts', () => {
    const source = [
      "it('empty', () => {});",
      "it('acts only', async () => {",
      '  await render();',
      '});',
    ].join('\n');
    expect(summarize(source)).toEqual(['no-assertion@1', 'no-assertion@2']);
  });

  it.each([
    ['expect', 'expect(1).toBe(1);'],
    ['expect.poll', 'await expect.poll(() => 1).toBe(1);'],
    ['expect.soft', 'expect.soft(1).toBe(1);'],
    ['expect with resolves', 'await expect(Promise.resolve(1)).resolves.toBe(1);'],
    ['assert call', 'assert(true);'],
    ['assert member', 'assert.equal(1, 1);'],
    ['expectTypeOf', 'expectTypeOf(1).toBeNumber();'],
    ['snapshot matcher', 'matchers.toMatchSnapshot();'],
    ['screenshot matcher', 'await page.locator.toHaveScreenshot();'],
    ['inside test.step', "await test.step('s', async () => { expect(1).toBe(1); });"],
  ])('accepts %s', (_name, statement) => {
    expect(summarize(`it('a', async () => { ${statement} });`)).toEqual([]);
  });

  it('checks table-driven and Playwright forms', () => {
    const source = [
      "it.each([1, 2])('table %d', (n) => { void n; });",
      "test('pw', { tag: '@a' }, async ({ page }) => { await page.goto('/'); });",
      "test('pw ok', async ({ page }) => { await expect(page).toHaveURL('/'); });",
    ].join('\n');
    expect(summarize(source)).toEqual(['no-assertion@1', 'no-assertion@2']);
  });

  it('does not treat suites, hooks, steps or conditional callbacks as tests', () => {
    const source = [
      "describe('suite', () => {",
      '  beforeEach(() => { setup(); });',
      '});',
      "test.describe('pw suite', () => {",
      '  test.beforeEach(() => { setup(); });',
      '});',
      "it('a', async () => {",
      "  await test.step('s', () => { act(); });",
      '  test.fail(({ browserName }) => browserName === "x");',
      '  expect(1).toBe(1);',
      '});',
    ].join('\n');
    expect(summarize(source)).toEqual([]);
  });

  it('flags a table-driven test written as a tagged template', () => {
    expect(summarize("it.each`\n  a | b\n`('t', () => {});")).toEqual(['no-assertion@1']);
  });

  it('judges the body of an expected-failure test', () => {
    expect(summarize("it.fails('a', () => {});")).toEqual(['no-assertion@1']);
    expect(summarize("it.fails('a', () => { expect(1).toBe(2); });")).toEqual([]);
  });

  it('reports two different rules broken by the same call', () => {
    expect(summarize("it.only('a', () => {});")).toEqual(['focused@1', 'no-assertion@1']);
  });

  it('resolves a named body when the title is a template literal', () => {
    expect(summarize('function body() { return 1; }\nit(`t`, body);')).toEqual(['no-assertion@2']);
  });

  it('reports two violations that share a line separately', () => {
    expect(summarize("it('a', () => {}); it('b', () => {});")).toEqual([
      'no-assertion@1',
      'no-assertion@1',
    ]);
  });

  it('counts a call to a local helper that asserts, directly or through another helper', () => {
    const source = [
      'function inner() { expect(1).toBe(1); }',
      'const outer = () => { inner(); };',
      'const viaFunctionExpression = function () { outer(); };',
      "it('a', () => { outer(); });",
      "it('b', () => { viaFunctionExpression(); });",
    ].join('\n');
    expect(summarize(source)).toEqual([]);
  });

  it('does not count a local helper that never asserts, whatever its name', () => {
    const source = [
      'function expectSomething() { return 1; }',
      "it('a', () => { expectSomething(); });",
    ].join('\n');
    expect(summarize(source)).toEqual(['no-assertion@2']);
  });

  it('terminates on helpers that call each other and never assert', () => {
    const source = [
      'function a() { b(); }',
      'function b() { a(); }',
      "it('x', () => { a(); });",
    ].join('\n');
    expect(summarize(source)).toEqual(['no-assertion@3']);
  });

  it('resolves a test body passed by name to a local function', () => {
    const source = [
      'function body() { return 1; }',
      "it('a', body);",
      'function checked() { expect(1).toBe(1); }',
      "it('b', checked);",
    ].join('\n');
    expect(summarize(source)).toEqual(['no-assertion@2']);
  });

  it('does not judge a skipped test body, only its missing reason', () => {
    expect(summarize("it.skip('a', () => {});")).toEqual(['skip-without-reason@1']);
  });

  it('reads tsx sources', () => {
    const source = "it('a', () => { render(<div />); });";
    expect(summarize(source, 'view.test.tsx')).toEqual(['no-assertion@1']);
  });
});

describe('skips without a reason', () => {
  it.each([
    ['declarative it.skip', "it.skip('a', () => { expect(1).toBe(1); });"],
    ['declarative test.fixme', "test.fixme('a', async () => { await expect(1).toBe(1); });"],
    ['describe.skip', "describe.skip('a', () => {});"],
    ['test.describe.skip', "test.describe.skip('a', () => {});"],
    ['conditional with no reason', 'test.skip(isMobile);'],
    ['unconditional with no arguments', 'test.skip();'],
    ['conditional with an empty reason', "test.skip(isMobile, '');"],
    ['conditional with a blank reason', 'test.skip(isMobile, `   `);'],
    ['callback condition with no reason', "test.skip(({ browserName }) => browserName === 'x');"],
    ['fixme with no reason', 'test.fixme(isMobile);'],
  ])('flags %s', (_name, source) => {
    expect(summarize(source)).toEqual(['skip-without-reason@1']);
  });

  it.each([
    ['literal reason', "test.skip(isMobile, 'a phone renders the mobile mixer');"],
    ['callback condition with reason', "test.skip(({ browserName }) => browserName !== 'x', 'r');"],
    ['concatenated reason', "test.skip(!supported, 'engine lacks ' + feature);"],
    ['named reason', 'test.skip(!supported, NO_SUPPORT_REASON);'],
    ['fixme with reason', "test.fixme(isMobile, 'tracked');"],
    ['multi-line call', "test.skip(\n  isMobile,\n  'reason on its own line',\n);"],
  ])('accepts %s', (_name, source) => {
    expect(summarize(source)).toEqual([]);
  });

  it('reports each violation of a file in source order', () => {
    const source = [
      "it.only('a', () => { expect(1).toBe(1); });",
      "it('b', () => {});",
      'test.skip(isMobile);',
    ].join('\n');
    expect(summarize(source)).toEqual(['focused@1', 'no-assertion@2', 'skip-without-reason@3']);
  });
});

describe('scanRoot', () => {
  const roots: string[] = [];

  function makeTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'test-integrity-'));
    roots.push(root);
    for (const [name, content] of Object.entries(files)) {
      const full = join(root, name);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, content);
    }
    return root;
  }

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  const FOCUSED = "it.only('a', () => { expect(1).toBe(1); });";

  it('scans vitest, Playwright and component e2e files and reports paths relative to the root', () => {
    const root = makeTree({
      'lib/a.test.ts': FOCUSED,
      'components/b.test.tsx': FOCUSED,
      'tests/e2e/c.spec.ts': FOCUSED,
      'components/d.e2e.ts': FOCUSED,
      '__tests__/e.test.mjs': FOCUSED,
    });
    const result = scanRoot(root);
    expect(result.files).toBe(5);
    expect(result.violations.map((v) => v.file).sort()).toEqual([
      '__tests__/e.test.mjs',
      'components/b.test.tsx',
      'components/d.e2e.ts',
      'lib/a.test.ts',
      'tests/e2e/c.spec.ts',
    ]);
  });

  it('skips dependency, build and worktree directories and files that are not tests', () => {
    const root = makeTree({
      'node_modules/pkg/x.test.ts': FOCUSED,
      '.next/y.test.ts': FOCUSED,
      '.worktrees/z/z.test.ts': FOCUSED,
      'tests/e2e/_helpers/fixtures.ts': FOCUSED,
      'lib/plain.ts': FOCUSED,
    });
    expect(scanRoot(root)).toEqual({ files: 0, violations: [] });
  });
});

describe('scanRoot with helpers from other modules', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function scan(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), 'test-integrity-helpers-'));
    roots.push(root);
    for (const [name, content] of Object.entries(files)) {
      const full = join(root, name);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, content);
    }
    return scanRoot(root).violations.map((v) => `${v.file}:${v.line}:${v.kind}`);
  }

  const ASSERTING_HELPER =
    "import { expect } from 'vitest';\nexport async function snapshot() { expect(1).toBe(1); }\n";
  const IDLE_HELPER = 'export async function snapshot() { return 1; }\n';
  const USES_HELPER = (from: string) =>
    `import { snapshot } from '${from}';\nit('a', async () => { await snapshot(); });\n`;

  it('counts a relative import whose function asserts', () => {
    expect(
      scan({
        'tests/_helpers/snapshot.ts': ASSERTING_HELPER,
        'tests/a.test.ts': USES_HELPER('./_helpers/snapshot'),
      }),
    ).toEqual([]);
  });

  it('counts an alias import and a directory index', () => {
    expect(
      scan({
        'lib/helper/index.ts': ASSERTING_HELPER,
        'tests/a.test.ts': USES_HELPER('@/lib/helper'),
      }),
    ).toEqual([]);
  });

  it('flags a test whose imported helper never asserts', () => {
    expect(
      scan({
        'tests/_helpers/snapshot.ts': IDLE_HELPER,
        'tests/a.test.ts': USES_HELPER('./_helpers/snapshot'),
      }),
    ).toEqual(['tests/a.test.ts:2:no-assertion']);
  });

  it('counts an aliased import by its local name', () => {
    expect(
      scan({
        'tests/_helpers/snapshot.ts': ASSERTING_HELPER,
        'tests/a.test.ts':
          "import { snapshot as check } from './_helpers/snapshot';\nit('a', async () => { await check(); });\n",
      }),
    ).toEqual([]);
  });

  it('does not resolve a namespace import and does not crash on one', () => {
    expect(
      scan({
        'tests/_helpers/snapshot.ts': ASSERTING_HELPER,
        'tests/a.test.ts':
          "import * as helpers from './_helpers/snapshot';\nit('a', async () => { await helpers.snapshot(); });\n",
      }),
    ).toEqual(['tests/a.test.ts:2:no-assertion']);
  });

  it('flags a test that imports a different name than the one that asserts', () => {
    expect(
      scan({
        'tests/_helpers/snapshot.ts': `${ASSERTING_HELPER}export async function other() { return 1; }\n`,
        'tests/a.test.ts':
          "import { other as snapshot } from './_helpers/snapshot';\nit('a', async () => { await snapshot(); });\n",
      }),
    ).toEqual(['tests/a.test.ts:2:no-assertion']);
  });

  it('follows a helper that asserts through a helper of its own, and survives an import cycle', () => {
    expect(
      scan({
        'tests/_helpers/outer.ts':
          "import { snapshot } from './inner';\nexport async function outer() { await snapshot(); }\n",
        'tests/_helpers/inner.ts': `${ASSERTING_HELPER}import { outer } from './outer';\nvoid outer;\n`,
        'tests/a.test.ts':
          "import { outer } from './_helpers/outer';\nit('a', async () => { await outer(); });\n",
      }),
    ).toEqual([]);
  });

  it('follows a named re-export through a barrel', () => {
    expect(
      scan({
        'tests/_helpers/helper.ts': ASSERTING_HELPER,
        'tests/_helpers/index.ts': "export { snapshot } from './helper';\n",
        'tests/a.test.ts': USES_HELPER('./_helpers'),
      }),
    ).toEqual([]);
  });

  it('follows a renamed re-export through a barrel', () => {
    expect(
      scan({
        'tests/_helpers/helper.ts': ASSERTING_HELPER,
        'tests/_helpers/index.ts': "export { snapshot as verify } from './helper';\n",
        'tests/a.test.ts':
          "import { verify } from './_helpers';\nit('a', async () => { await verify(); });\n",
      }),
    ).toEqual([]);
  });

  it('follows a star re-export through a barrel', () => {
    expect(
      scan({
        'tests/_helpers/helper.ts': ASSERTING_HELPER,
        'tests/_helpers/index.ts': "export * from './helper';\n",
        'tests/a.test.ts': USES_HELPER('./_helpers'),
      }),
    ).toEqual([]);
  });

  it('follows a chain of barrels', () => {
    expect(
      scan({
        'tests/_helpers/helper.ts': ASSERTING_HELPER,
        'tests/_helpers/inner/index.ts': "export * from '../helper';\n",
        'tests/_helpers/index.ts': "export * from './inner';\n",
        'tests/a.test.ts': USES_HELPER('./_helpers'),
      }),
    ).toEqual([]);
  });

  it('flags a test whose barrel re-exports a helper that never asserts', () => {
    expect(
      scan({
        'tests/_helpers/helper.ts': IDLE_HELPER,
        'tests/_helpers/index.ts':
          "export * from './helper';\nexport { snapshot as other } from './helper';\n",
        'tests/a.test.ts': USES_HELPER('./_helpers'),
      }),
    ).toEqual(['tests/a.test.ts:2:no-assertion']);
  });

  it('survives barrels that re-export each other', () => {
    expect(
      scan({
        'tests/_helpers/a.ts': "export * from './b';\n",
        'tests/_helpers/b.ts': `export * from './a';\n${ASSERTING_HELPER}`,
        'tests/a.test.ts': USES_HELPER('./_helpers/a'),
      }),
    ).toEqual([]);
  });

  it.each([
    ['a default function declaration', 'export default async function () { expect(1).toBe(1); }\n'],
    ['a named default function', 'export default async function named() { expect(1).toBe(1); }\n'],
    ['a default arrow function', 'export default async () => { expect(1).toBe(1); };\n'],
    [
      'a default identifier',
      'async function local() { expect(1).toBe(1); }\nexport default local;\n',
    ],
    [
      'an export list default',
      'async function local() { expect(1).toBe(1); }\nexport { local as default };\n',
    ],
  ])('counts a default import whose target exports %s', (_name, helper) => {
    expect(
      scan({
        'tests/_helpers/def.ts': helper,
        'tests/a.test.ts':
          "import assertDef from './_helpers/def';\nit('a', async () => { await assertDef(); });\n",
      }),
    ).toEqual([]);
  });

  it('flags a default import whose target default export never asserts', () => {
    expect(
      scan({
        'tests/_helpers/def.ts': `${ASSERTING_HELPER}export default async function idle() { return 1; }\n`,
        'tests/a.test.ts':
          "import assertDef from './_helpers/def';\nit('a', async () => { await assertDef(); });\n",
      }),
    ).toEqual(['tests/a.test.ts:2:no-assertion']);
  });

  it('follows a default re-export through a barrel', () => {
    expect(
      scan({
        'tests/_helpers/def.ts': 'export default async function () { expect(1).toBe(1); }\n',
        'tests/_helpers/index.ts':
          "export { default as verify } from './def';\nexport { default } from './def';\n",
        'tests/a.test.ts':
          "import assertDef, { verify } from './_helpers';\nit('a', async () => { await assertDef(); });\nit('b', async () => { await verify(); });\n",
      }),
    ).toEqual([]);
  });

  it('does not count a named import as the default export', () => {
    expect(
      scan({
        'tests/_helpers/def.ts': `${IDLE_HELPER}export default async function () { expect(1).toBe(1); }\n`,
        'tests/a.test.ts': USES_HELPER('./_helpers/def'),
      }),
    ).toEqual(['tests/a.test.ts:2:no-assertion']);
  });

  const CYCLE_A =
    "import { fromB } from './b';\nexport async function fromA() { await fromB(); }\n";
  const CYCLE_B =
    "import { fromA } from './a';\nexport async function fromB() { expect(1).toBe(1); }\nexport async function loop() { await fromA(); }\n";
  const IMPORTS_FROM_A =
    "import { fromA } from './_helpers/a';\nit('a', async () => { await fromA(); });\n";
  const IMPORTS_LOOP_FROM_B =
    "import { loop } from './_helpers/b';\nit('b', async () => { await loop(); });\n";

  it.each([
    ['the member that asserts directly is reached first', IMPORTS_LOOP_FROM_B, IMPORTS_FROM_A],
    [
      'the member that asserts through its peer is reached first',
      IMPORTS_FROM_A,
      IMPORTS_LOOP_FROM_B,
    ],
  ])(
    'counts helpers that assert through an import cycle whichever test is scanned first (%s)',
    (_name, first, second) => {
      expect(
        scan({
          'tests/_helpers/a.ts': CYCLE_A,
          'tests/_helpers/b.ts': CYCLE_B,
          'tests/0.test.ts': first,
          'tests/1.test.ts': second,
        }),
      ).toEqual([]);
    },
  );

  it('flags a helper in an import cycle that no member asserts through', () => {
    expect(
      scan({
        'tests/_helpers/a.ts':
          "import { fromB } from './b';\nexport async function fromA() { await fromB(); }\n",
        'tests/_helpers/b.ts':
          "import { fromA } from './a';\nexport async function fromB() { await fromA(); }\n",
        'tests/0.test.ts': IMPORTS_FROM_A,
      }),
    ).toEqual(['tests/0.test.ts:2:no-assertion']);
  });

  it('leaves a package import as unknown, so it does not count as an assertion', () => {
    expect(
      scan({
        'tests/a.test.ts': "import { check } from 'some-package';\nit('a', () => { check(); });\n",
      }),
    ).toEqual(['tests/a.test.ts:2:no-assertion']);
  });
});

describe('command line', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function run(source: string) {
    const root = mkdtempSync(join(tmpdir(), 'test-integrity-cli-'));
    roots.push(root);
    writeFileSync(join(root, 'a.test.ts'), source);
    return spawnSync('pnpm', ['exec', 'tsx', SCRIPT, root], { encoding: 'utf8' });
  }

  it('exits 1 and names file, line and rule for a violation', () => {
    const result = run("it('a', () => {});\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('a.test.ts:1');
    expect(result.stderr).toContain('no-assertion');
  });

  it('exits 0 for a clean tree', () => {
    const result = run("it('a', () => { expect(1).toBe(1); });\n");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK');
  });
});
