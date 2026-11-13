import { defineConfig, devices, type Project } from 'playwright/test';

const CROSS_BROWSER_SPECS =
  /tests\/e2e\/(shared-header|cross-cutting|motion-switch|observability-smoke|design-system-pages|links|contact-delivery|contact-timezone|guitar-mobile|guitar-eq|mixer-mobile|reading-views|cv-layout|error-states|error-pages-fit|no-js|mobile-reflow|hero-layout|section-surfaces|route-surfaces|type-scale|streamed-settle|shell-input-states|shell-hydration|refs-privacy|safe-zone|section-visual-order|error-pages-alignment|links-chrome-alignment|command-wrap|career-wrap|dock-labels|pt-hero-boot|palette-discipline|leading-integrity)\.spec\.ts$/;
const VISUAL_SPEC = /tests\/visual\/visual\.spec\.ts$/;

const DEFAULT_BASE_URL = 'http://localhost:3000';
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const NESTED_WORKTREE_DIRECTORIES = String.raw`\.(?:claude/)?worktrees/`;

export function nestedWorktreeIgnore(rootDir: string): RegExp {
  const root = rootDir.replace(REGEX_SPECIAL_CHARACTERS, String.raw`\$&`);
  return new RegExp(`^${root}/${NESTED_WORKTREE_DIRECTORIES}`);
}

const NESTED_WORKTREES = nestedWorktreeIgnore(import.meta.dirname);

// Typed as Project[] so the literal types of the per-project settings survive
// the extraction: inside the config object they were contextually narrowed
// ('chromium' as a BrowserName), and a plain const array widens them back to
// string, which the typecheck rejects.
const PROJECT_DEFINITIONS: Project[] = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    testIgnore: process.env.CI ? /design-system-components\.spec\.ts/ : [],
  },
  {
    name: 'chromium-mobile',
    use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
    testMatch: [CROSS_BROWSER_SPECS, VISUAL_SPEC],
  },
  {
    name: 'webkit-desktop',
    use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
    testMatch: CROSS_BROWSER_SPECS,
  },
  {
    name: 'webkit-mobile',
    use: { ...devices['iPhone 14'] },
    testMatch: CROSS_BROWSER_SPECS,
  },

  {
    name: 'chromium-components',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    testDir: '.',
    testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
  },
  {
    name: 'chromium-mobile-components',
    use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
    testDir: '.',
    testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
  },
  {
    name: 'webkit-desktop-components',
    use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
    testDir: '.',
    testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
  },
  {
    name: 'webkit-mobile-components',
    use: { ...devices['iPhone 14'] },
    testDir: '.',
    testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
  },
];

function ignoreList(ignore: Project['testIgnore']): Array<string | RegExp> {
  if (ignore === undefined) return [];
  return Array.isArray(ignore) ? ignore : [ignore];
}

const PROJECTS: Project[] = PROJECT_DEFINITIONS.map((project) => ({
  ...project,
  testIgnore: [...ignoreList(project.testIgnore), NESTED_WORKTREES],
}));

// The count the README states, exported so the documentation and the matrix
// cannot drift apart: a ninth project added here has to be counted there.
export const E2E_PROJECT_COUNT = PROJECTS.length;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  failOnFlakyTests: !!process.env.CI,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ...(process.env.GITHUB_ACTIONS ? ([['github'], ['list']] as const) : ([['list']] as const)),
    ...(process.env.ARGOS_TOKEN ? [['@argos-ci/playwright/reporter'] as [string]] : []),
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL,
    trace: 'on-first-retry',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: PROJECTS,
});
