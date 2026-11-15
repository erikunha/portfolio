import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { trackedFiles } from '@/scripts/lib/git';

const ROOT = process.cwd();
const TEST_FILE = /\.test\.(ts|tsx)$/;
const BUDGET_MOCK = /vi\.(?:do)?[mM]ock\(\s*'@\/lib\/ask\/budget'\s*,\s*([^\n]*)/g;
const USES_FACTORY = /budgetModule\(/;
const RESERVE_ONLY_TESTS: ReadonlySet<string> = new Set([
  '__tests__/meta/budget-mock-factory.test.ts',
  'lib/ask/preflight.test.ts',
  'lib/ask/preflight-budget-refusal.test.ts',
]);

function handWrittenBudgetMocks(path: string, source: string): string[] {
  if (RESERVE_ONLY_TESTS.has(path)) return [];
  const offenders: string[] = [];
  for (const match of source.matchAll(BUDGET_MOCK)) {
    const start = match.index ?? 0;
    const window = source.slice(start, start + source.slice(start).indexOf(');') + 2);
    if (!USES_FACTORY.test(window)) offenders.push(path);
  }
  return offenders;
}

describe('mocks of lib/ask/budget', () => {
  it('flags a hand-written factory and accepts the shared one', () => {
    const handWritten = "vi.mock('@/lib/ask/budget', () => ({ reserveBudget, settleBudget }));";
    const shared =
      "vi.mock('@/lib/ask/budget', async () => (await import('../helpers/ask-route')).budgetModule());";
    expect(handWrittenBudgetMocks('x.test.ts', handWritten)).toEqual(['x.test.ts']);
    expect(handWrittenBudgetMocks('x.test.ts', shared)).toEqual([]);
    expect(handWrittenBudgetMocks('lib/ask/preflight.test.ts', handWritten)).toEqual([]);
  });

  it('go through budgetModule, so a new budget export reaches every test that runs the stream', () => {
    const offenders = trackedFiles([], { cwd: ROOT })
      .filter((path) => TEST_FILE.test(path))
      .flatMap((path) => handWrittenBudgetMocks(path, readFileSync(join(ROOT, path), 'utf8')));
    expect(
      offenders,
      'a hand-written budget mock lacks exports the stream calls (settleReservation); the stream catches the missing-export error and skips settlement silently. Use budgetModule from __tests__/helpers/ask-route.ts',
    ).toEqual([]);
  });
});
