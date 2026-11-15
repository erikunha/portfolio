import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BIOME_BIN = join(ROOT, 'node_modules', '.bin', 'biome');
const FIXTURES = join(ROOT, '__tests__', 'fixtures', 'layer-direction');
const RULE = 'lint/style/noRestrictedImports';
const DIAGNOSTIC_HEADER = /^(\S+\.ts):\d+:\d+ (\S+)/;
const INLINE_FILES: Record<string, string> = {
  'content/allowed.ts':
    "import { z } from 'zod';\nimport '@/content/hero';\nexport const schema = z.string();\n",
  'design-system/allowed.ts': "import '@/lib/cn';\nimport 'react';\n",
  'lib/rate-limit.ts': "import '@/lib/redis';\n",
};
const RATE_LIMIT_FORBIDDEN: Record<string, string> = {
  'lib/rate-limit.ts': "import '@/lib/ask/budget';\n",
};
const RATE_LIMIT_FORBIDDEN_EVAL: Record<string, string> = {
  'lib/rate-limit.ts': "import '@/lib/eval/runner';\n",
};

function lintTree(extra: Record<string, string>): Map<string, string[]> {
  const dir = mkdtempSync(join(tmpdir(), 'layer-direction-'));
  try {
    const config = JSON.parse(readFileSync(join(ROOT, 'biome.json'), 'utf8'));
    config.vcs = { enabled: false };
    writeFileSync(join(dir, 'biome.json'), JSON.stringify(config));
    cpSync(FIXTURES, dir, { recursive: true });
    for (const [rel, body] of Object.entries(extra)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), body);
    }
    const run = spawnSync(BIOME_BIN, ['lint', '--colors=off', '--max-diagnostics=200', '.'], {
      cwd: dir,
      encoding: 'utf8',
    });
    const reported = new Map<string, string[]>();
    for (const line of `${run.stdout}\n${run.stderr}`.split('\n')) {
      const match = DIAGNOSTIC_HEADER.exec(line);
      const [, file, rule] = match ?? [];
      if (!file || !rule) continue;
      reported.set(file, [...(reported.get(file) ?? []), rule]);
    }
    return reported;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('import direction rules in biome.json', () => {
  let base: Map<string, string[]>;
  let rateLimitBudget: Map<string, string[]>;
  let rateLimitEval: Map<string, string[]>;

  beforeAll(() => {
    base = lintTree(INLINE_FILES);
    rateLimitBudget = lintTree(RATE_LIMIT_FORBIDDEN);
    rateLimitEval = lintTree(RATE_LIMIT_FORBIDDEN_EVAL);
  });

  it.each([
    'lib/forbidden-app.ts',
    'lib/forbidden-components.ts',
    'content/forbidden-lib.ts',
    'design-system/forbidden-lib.ts',
  ])('reports %s', (file) => {
    expect(base.get(file)).toContain(RULE);
  });

  it('reports lib/rate-limit.ts importing from lib/ask', () => {
    expect(rateLimitBudget.get('lib/rate-limit.ts')).toContain(RULE);
  });

  it('reports lib/rate-limit.ts importing from lib/eval', () => {
    expect(rateLimitEval.get('lib/rate-limit.ts')).toContain(RULE);
  });

  it.each([
    'lib/allowed.ts',
    'content/allowed.ts',
    'design-system/allowed.ts',
    'lib/rate-limit.ts',
  ])('accepts the allowed imports in %s', (file) => {
    expect(base.get(file) ?? []).not.toContain(RULE);
  });
});
