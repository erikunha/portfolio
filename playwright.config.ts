import { defineConfig, devices, type Project } from 'playwright/test';

const CROSS_BROWSER_GREP = /@cross-browser(?![\w-])/;
const CROSS_BROWSER_AND_VISUAL_GREP = /@cross-browser(?![\w-])|@mobile-visual(?![\w-])/;

const DEFAULT_BASE_URL = 'http://localhost:3000';
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const NESTED_WORKTREE_DIRECTORIES = String.raw`\.(?:claude/)?worktrees/`;

export function nestedWorktreeIgnore(rootDir: string): RegExp {
  const root = rootDir.replace(REGEX_SPECIAL_CHARACTERS, String.raw`\$&`);
  return new RegExp(`^${root}/${NESTED_WORKTREE_DIRECTORIES}`);
}

const NESTED_WORKTREES = nestedWorktreeIgnore(import.meta.dirname);

const BROWSER_PROFILES: Array<Required<Pick<Project, 'name' | 'use'>>> = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
  },
  {
    name: 'chromium-mobile',
    use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
  },
  {
    name: 'webkit-desktop',
    use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
  },
  {
    name: 'webkit-mobile',
    use: { ...devices['iPhone 14'] },
  },
];

const PAGE_PROJECT_OPTIONS: Record<string, Partial<Project>> = {
  chromium: { testIgnore: process.env.CI ? /design-system-components\.spec\.ts/ : [] },
  'chromium-mobile': { grep: CROSS_BROWSER_AND_VISUAL_GREP },
  'webkit-desktop': { grep: CROSS_BROWSER_GREP },
  'webkit-mobile': { grep: CROSS_BROWSER_GREP },
};

const COMPONENT_PROJECT_OPTIONS: Partial<Project> = {
  testDir: '.',
  testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
};

const PROJECT_DEFINITIONS: Project[] = [
  ...BROWSER_PROFILES.map((profile) => ({ ...profile, ...PAGE_PROJECT_OPTIONS[profile.name] })),
  ...BROWSER_PROFILES.map((profile) => ({
    ...profile,
    name: `${profile.name}-components`,
    ...COMPONENT_PROJECT_OPTIONS,
  })),
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
