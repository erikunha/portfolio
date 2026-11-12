import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { nestedWorktreeIgnore } from '../playwright.config';

const REPO_ROOT = path.resolve(__dirname, '..');
const NESTED_WORKTREE_SPECS = [
  `${REPO_ROOT}/.claude/worktrees/agent-x/components/client/InteractiveShell/InteractiveShell.e2e.ts`,
  `${REPO_ROOT}/.claude/worktrees/agent-x/tests/e2e/links.spec.ts`,
  `${REPO_ROOT}/.claude/worktrees/agent-x/tests/visual/visual.spec.ts`,
  `${REPO_ROOT}/.worktrees/feature/tests/e2e/links.spec.ts`,
];
const CHECKOUT_INSIDE_A_WORKTREE = '/home/dev/portfolio/.claude/worktrees/agent-x';
const CI_ENV_VALUE = '1';

type Matcher = RegExp | string;

function asList(value: Matcher | Matcher[] | undefined): Matcher[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function ignores(testIgnore: Matcher | Matcher[] | undefined, specPath: string): boolean {
  return asList(testIgnore).some((matcher) => matcher instanceof RegExp && matcher.test(specPath));
}

async function loadConfig(ciMode: boolean) {
  vi.resetModules();
  vi.stubEnv('CI', ciMode ? CI_ENV_VALUE : undefined);
  const reloaded = await import('../playwright.config');
  vi.unstubAllEnvs();
  return reloaded.default;
}

describe('playwright.config.ts and worktrees nested inside the checkout', () => {
  it.each([false, true])(
    'no project collects a spec from a nested worktree (CI=%s), so a second @playwright/test copy is never loaded',
    async (ciMode) => {
      const config = await loadConfig(ciMode);
      const projects = config.projects ?? [];
      expect(projects.length).toBeGreaterThan(0);
      for (const project of projects) {
        for (const specPath of NESTED_WORKTREE_SPECS) {
          expect(
            ignores(project.testIgnore as Matcher | Matcher[] | undefined, specPath),
            `${project.name} collects ${specPath}`,
          ).toBe(true);
        }
      }
    },
  );

  it('still collects the checkout own specs', async () => {
    const config = await loadConfig(false);
    for (const project of config.projects ?? []) {
      expect(
        ignores(
          project.testIgnore as Matcher | Matcher[] | undefined,
          `${REPO_ROOT}/tests/e2e/links.spec.ts`,
        ),
      ).toBe(false);
      expect(
        ignores(
          project.testIgnore as Matcher | Matcher[] | undefined,
          `${REPO_ROOT}/components/client/InteractiveShell/InteractiveShell.e2e.ts`,
        ),
      ).toBe(false);
    }
  });

  it('a checkout that is itself a nested worktree still collects its own specs', () => {
    const ignore = nestedWorktreeIgnore(CHECKOUT_INSIDE_A_WORKTREE);
    expect(ignore.test(`${CHECKOUT_INSIDE_A_WORKTREE}/tests/e2e/links.spec.ts`)).toBe(false);
    expect(ignore.test(`${CHECKOUT_INSIDE_A_WORKTREE}/components/client/Shell/Shell.e2e.ts`)).toBe(
      false,
    );
    expect(
      ignore.test(
        `${CHECKOUT_INSIDE_A_WORKTREE}/.claude/worktrees/agent-y/tests/e2e/links.spec.ts`,
      ),
    ).toBe(true);
  });
});
