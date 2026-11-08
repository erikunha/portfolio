import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BIOME_BIN = join(ROOT, 'node_modules', '.bin', 'biome');
const SCRATCH_PREFIX = 'biome-rules-';
const ERROR_SEVERITY = 'error';

type Fixture = { rule: string; file: string; source: string };

const FIXTURES: Fixture[] = [
  {
    rule: 'suspicious/noLoopFunc',
    file: 'loop-func.ts',
    source:
      'let n = 0;\nconst fns: (() => number)[] = [];\nfor (const item of [1, 2]) {\n  fns.push(() => n + item);\n  n += 1;\n}\n',
  },
  {
    rule: 'suspicious/noIdenticalTestTitle',
    file: 'identical-title.test.ts',
    source:
      "import { it } from 'vitest';\nit('same', () => undefined);\nit('same', () => undefined);\n",
  },
  {
    rule: 'complexity/useArraySome',
    file: 'array-some.ts',
    source: 'export const has = [1, 2].filter((n) => n > 1).length > 0;\n',
  },
  {
    rule: 'complexity/noUnnecessaryTemplateExpression',
    file: 'template.ts',
    source: `export const x = \`a\${"b"}c\`;\n`,
  },
  {
    rule: 'complexity/useMathMinMax',
    file: 'min-max.ts',
    source: 'export const m = (a: number, b: number) => (a > b ? a : b);\n',
  },
  {
    rule: 'complexity/useRegexpTest',
    file: 'regexp-test.ts',
    source: 'export const ok = (s: string) => (s.match(/a/) ? 1 : 0);\n',
  },
  {
    rule: 'complexity/noPlaywrightUselessAwait',
    file: 'useless-await.spec.ts',
    source:
      "import { test } from '@playwright/test';\ntest('a', async ({ page }) => {\n  await page.locator('a');\n});\n",
  },
  {
    rule: 'correctness/noPlaywrightMissingAwait',
    file: 'missing-await.spec.ts',
    source:
      "import { expect, test } from '@playwright/test';\ntest('a', async ({ page }) => {\n  expect(page.locator('a')).toBeVisible();\n});\n",
  },
  {
    rule: 'correctness/usePlaywrightValidDescribeCallback',
    file: 'describe-callback.spec.ts',
    source:
      "import { test } from '@playwright/test';\ntest.describe('x', async () => {\n  test('a', () => undefined);\n});\n",
  },
  {
    rule: 'security/useIframeSandbox',
    file: 'iframe.tsx',
    source: 'export const F = () => <iframe src="https://example.com" title="x" />;\n',
  },
  {
    rule: 'performance/useDomNodeTextContent',
    file: 'inner-text.ts',
    source: 'export const t = (el: HTMLElement) => el.innerText;\n',
  },
  {
    rule: 'style/useVarsOnTop',
    file: 'vars-on-top.ts',
    source: 'export function f() {\n  console.log(1);\n  var x = 1;\n  return x;\n}\n',
  },
  {
    rule: 'nursery/noTailwindRawColors',
    file: 'raw-color.tsx',
    source: 'export const C = () => <div className="text-red-500" />;\n',
  },
];

type Diagnostic = {
  category: string;
  severity: string;
  location: { path: string | { file?: string } };
};

function fileOf(diagnostic: Diagnostic): string | undefined {
  const { path } = diagnostic.location;
  return typeof path === 'string' ? path : path.file;
}

describe('biome.json lint rules', () => {
  let scratch = '';
  let diagnostics: Diagnostic[] = [];

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), SCRATCH_PREFIX));
    const config = JSON.parse(readFileSync(join(ROOT, 'biome.json'), 'utf8'));
    config.vcs = { enabled: false };
    config.files = { ignoreUnknown: true, includes: ['**'] };
    writeFileSync(join(scratch, 'biome.json'), JSON.stringify(config));
    copyFileSync(join(ROOT, 'package.json'), join(scratch, 'package.json'));
    for (const { file, source } of FIXTURES) writeFileSync(join(scratch, file), source);
    const run = spawnSync(BIOME_BIN, ['lint', '--reporter=json', '.'], {
      cwd: scratch,
      encoding: 'utf8',
    });
    diagnostics = JSON.parse(run.stdout).diagnostics;
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it.each(FIXTURES)('$rule fails the build on a minimal violation', ({ rule, file }) => {
    const hits = diagnostics.filter((d) => d.category === `lint/${rule}` && fileOf(d) === file);
    expect(
      hits,
      `${rule} is not enabled in biome.json: its violations would pass \`pnpm check\``,
    ).not.toHaveLength(0);
    expect(
      hits.every((d) => d.severity === ERROR_SEVERITY),
      `${rule} must be an error in biome.json: a warning does not fail \`pnpm check\``,
    ).toBe(true);
  });
});
