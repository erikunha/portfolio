import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  chainLeaves,
  coveredByCi,
  JOB_POLICIES,
  unclassifiedActions,
  unmappedJobs,
} from '../lib/ci-predict-policy';
import {
  type Deps,
  dockerExecPlaywrightArgs,
  dockerSessionArgs,
  type ExecResult,
  evalCommand,
  predict,
  type Row,
  type RunContext,
  selectSpecs,
  summaryTable,
} from '../lib/ci-predict-run';
import { parseWorkflow } from '../lib/ci-workflow';

const ciText = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');
const workflow = parseWorkflow(ciText);
const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf8')) as {
  scripts: Record<string, string>;
};

const COMPONENT_SPEC = 'components/sections/Hero/Hero.e2e.ts';
const LINKS_SPEC = 'tests/e2e/links.spec.ts';
const COMPONENT_PROJECTS = [
  'chromium-components',
  'chromium-mobile-components',
  'webkit-desktop-components',
  'webkit-mobile-components',
];
const PAGE_PROJECTS = ['chromium', 'chromium-mobile', 'webkit-desktop', 'webkit-mobile'];

const specProjects = new Map<string, Set<string>>([
  [COMPONENT_SPEC, new Set(COMPONENT_PROJECTS)],
  [LINKS_SPEC, new Set(PAGE_PROJECTS)],
  ['tests/e2e/layout-tokens.spec.ts', new Set(['chromium'])],
]);

interface Recorded {
  cmd: string;
  env: Record<string, string>;
}

function harness(options: {
  categories: { ai: boolean; app: boolean; ui: boolean };
  changedFiles: string[];
  failing?: RegExp;
  lockfileChanged?: boolean;
  full?: boolean;
  linux?: boolean;
  skipBuild?: boolean;
  evalLive?: boolean;
}) {
  const commands: Recorded[] = [];
  const playwright: { args: string[]; project: string | undefined }[] = [];
  const servers: Record<string, string>[] = [];
  const result = (code: number): ExecResult => ({ code, output: code === 0 ? '' : 'boom' });
  const append = (file: string | undefined, text: string) => {
    if (file) writeFileSync(file, text, { flag: 'a' });
  };
  const deps: Deps = {
    exec: async ({ cmd, env }) => {
      commands.push({ cmd, env });
      if (cmd.includes('detect-changes.mjs')) {
        const c = options.categories;
        append(env.GITHUB_OUTPUT, `ai=${c.ai}\napp=${c.app}\nui=${c.ui}\n`);
      }
      if (cmd.includes('pnpm-lock.yaml') && cmd.includes('GITHUB_OUTPUT')) {
        append(env.GITHUB_OUTPUT, `changed=${options.lockfileChanged === true}\n`);
      }
      return result(options.failing?.test(cmd) ? 1 : 0);
    },
    playwright: async ({ args, project }) => {
      playwright.push({ args, project });
      return result(0);
    },
    ensureServer: async (env) => {
      servers.push(env);
      return { hostUrl: 'http://localhost:3401', containerUrl: 'http://host.docker.internal:3401' };
    },
    commandExists: () => true,
    fileExists: () => false,
    now: () => 0,
  };
  const context: RunContext = {
    workflow,
    github: {
      baseSha: 'b'.repeat(40),
      headSha: 'h'.repeat(40),
      branch: 'feat/x',
      repository: 'o/r',
    },
    options: {
      full: options.full === true,
      linux: options.linux === true,
      skipBuild: options.skipBuild === true,
      evalLive: options.evalLive === true,
      keepGoing: false,
      repeat: 3,
    },
    changedFiles: options.changedFiles,
    specProjects,
    specSources: new Map(),
    evalRun: null,
  };
  return { deps, context, commands, playwright, servers };
}

const row = (rows: Row[], job: string) => rows.find((r) => r.job === job);

describe('job policy drift guard', () => {
  it('maps every job in ci.yml and nothing that ci.yml no longer has', () => {
    expect(unmappedJobs(workflow, JOB_POLICIES)).toEqual({ missing: [], stale: [] });
  });

  it('reports a job that ci.yml gains but the predictor does not map', () => {
    const extra = parseWorkflow(
      `${ciText}\n  brand-new-job:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo hi\n`,
    );
    expect(unmappedJobs(extra, JOB_POLICIES).missing).toEqual(['brand-new-job']);
  });

  it('reports a mapped job that ci.yml dropped', () => {
    const fewer = parseWorkflow('jobs:\n  typecheck:\n    steps: []\n');
    expect(unmappedJobs(fewer, JOB_POLICIES).stale).toContain('e2e-functional');
  });

  it('classifies every action ci.yml uses, and flags a new one', () => {
    expect(unclassifiedActions(workflow)).toEqual([]);
    const extra = parseWorkflow(
      'jobs:\n  a:\n    steps:\n      - uses: some/new-action@abc123 # v1\n',
    );
    expect(unclassifiedActions(extra)).toEqual(['some/new-action']);
  });

  it('keeps every command of the ci:local chain covered by a quality-fast, typecheck or test step', () => {
    const ciCommands = ['quality-fast', 'typecheck', 'test'].flatMap((id) =>
      (workflow.jobs[id]?.steps ?? []).flatMap((s) => (s.run ? [s.run.trim()] : [])),
    );
    const leaves = chainLeaves(pkg.scripts, 'ci:local');
    expect(leaves.length).toBeGreaterThan(5);
    const uncovered = leaves.filter((leaf) => !coveredByCi(leaf, ciCommands, pkg.scripts));
    expect(uncovered, 'a verify step that no CI job runs is a check the predictor skips').toEqual(
      [],
    );
  });

  it('flags a verify command that no CI step covers', () => {
    const scripts = {
      ...pkg.scripts,
      verify: `${pkg.scripts.verify} && pnpm brand-new-check`,
      'brand-new-check': 'node x.mjs',
    };
    const leaves = chainLeaves(scripts, 'ci:local');
    expect(coveredByCi('pnpm brand-new-check', ['pnpm typecheck'], scripts)).toBe(false);
    expect(leaves).toContain('pnpm brand-new-check');
  });
});

describe('selectSpecs', () => {
  const sources = new Map([
    ['tests/e2e/links.spec.ts', "import { gotoSettled } from './_helpers/streamed';"],
    ['tests/e2e/layout-tokens.spec.ts', 'no helper import'],
  ]);

  it('selects a changed spec and a spec next to a changed component', () => {
    const files = [LINKS_SPEC, 'components/sections/Hero/Hero.tsx', 'README.md'];
    expect(selectSpecs(files, specProjects, sources).sort()).toEqual([COMPONENT_SPEC, LINKS_SPEC]);
  });

  it('selects the specs that import a changed e2e helper', () => {
    expect(selectSpecs(['tests/e2e/_helpers/streamed.ts'], specProjects, sources)).toEqual([
      LINKS_SPEC,
    ]);
  });

  it('selects every spec when the Playwright config changes', () => {
    expect(selectSpecs(['playwright.config.ts'], specProjects, sources).sort()).toEqual(
      [...specProjects.keys()].sort(),
    );
  });

  it('selects nothing for a docs-only change', () => {
    expect(selectSpecs(['docs/07-workflows.md'], specProjects, sources)).toEqual([]);
  });
});

describe('predict', () => {
  it('runs the quality, typecheck, unit and build steps ci.yml defines, with the build env from ci.yml', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: ['components/sections/Hero/Hero.tsx'],
    });
    const { rows } = await predict(h.context, h.deps);
    const cmds = h.commands.map((c) => c.cmd.trim());
    expect(cmds).toContain('pnpm biome ci .');
    expect(cmds).toContain('pnpm typecheck');
    expect(cmds).toContain('pnpm test:coverage');
    expect(cmds).toContain('node scripts/check-route-js.mjs');
    const build = h.commands.find((c) => c.cmd.trim() === 'pnpm build');
    expect(build?.env.DEPLOY_SALT).toBe('ci-build-salt');
    expect(build?.env.E2E_LINKS_FEED_FIXTURE).toBe('tests/e2e/fixtures/links-feed.json');
    expect(build?.env.CI).toBe('true');
    expect(build?.env.ANTHROPIC_API_KEY).toBe('');
    expect(row(rows, 'quality-fast')?.verdict).not.toBe('fail');
  });

  it('runs the install step once even though six jobs declare it', async () => {
    const h = harness({ categories: { ai: false, app: true, ui: false }, changedFiles: [] });
    await predict(h.context, h.deps);
    expect(
      h.commands.filter((c) => c.cmd.trim() === 'pnpm install --frozen-lockfile'),
    ).toHaveLength(1);
  });

  it('lints commits against the exact base and head, and skips the audit when the lockfile is unchanged', async () => {
    const h = harness({ categories: { ai: false, app: false, ui: false }, changedFiles: [] });
    await predict(h.context, h.deps);
    const commitlint = h.commands.find((c) => c.cmd.includes('commitlint'));
    expect(commitlint?.cmd).toContain(`--from ${'b'.repeat(40)} --to ${'h'.repeat(40)}`);
    expect(h.commands.some((c) => c.cmd.includes('pnpm audit'))).toBe(false);
  });

  it('runs the audit when the lockfile changed', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: ['pnpm-lock.yaml'],
      lockfileChanged: true,
    });
    await predict(h.context, h.deps);
    expect(h.commands.some((c) => c.cmd.includes('pnpm audit'))).toBe(true);
  });

  it('skips the app jobs when detect-changes reports no app change, and says why', async () => {
    const h = harness({
      categories: { ai: false, app: false, ui: false },
      changedFiles: ['README.md'],
    });
    const { rows } = await predict(h.context, h.deps);
    for (const job of ['performance', 'e2e-functional', 'e2e-visual-chromium', 'ai-eval']) {
      expect(row(rows, job)?.verdict, job).toBe('skipped');
    }
    expect(row(rows, 'e2e-functional')?.why).toContain('app=false');
    expect(h.playwright).toHaveLength(0);
  });

  it('runs a changed component spec on exactly the projects that list it, repeated with no retries', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: ['components/sections/Hero/Hero.tsx'],
    });
    const { rows } = await predict(h.context, h.deps);
    const e2e = h.playwright.filter((p) => p.args.includes(COMPONENT_SPEC));
    expect(e2e.map((p) => p.project).sort()).toEqual([...COMPONENT_PROJECTS].sort());
    for (const call of e2e) {
      expect(call.args).toContain('--repeat-each=3');
      expect(call.args).toContain('--retries=0');
      expect(call.args).not.toContain('tests/e2e/');
    }
    expect(row(rows, 'e2e-functional (chromium)')?.verdict).toBe('not-run');
    expect(row(rows, 'e2e-functional (chromium)')?.why).toMatch(/no changed spec/i);
    expect(row(rows, 'e2e-functional (webkit-mobile-components)')?.verdict).toBe('pass');
  });

  it('runs a changed cross-browser spec on webkit too', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: true },
      changedFiles: [LINKS_SPEC],
    });
    await predict(h.context, h.deps);
    const projects = h.playwright.filter((p) => p.args.includes(LINKS_SPEC)).map((p) => p.project);
    expect(projects.sort()).toEqual([...PAGE_PROJECTS].sort());
  });

  it('keeps the ci.yml arguments when asked for the full suite', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [],
      full: true,
    });
    await predict(h.context, h.deps);
    const call = h.playwright.find((p) => p.project === 'webkit-mobile');
    expect(call?.args).toContain('tests/e2e/');
    expect(call?.args).toContain('--repeat-each=3');
  });

  it('runs the visual spec on the projects ci.yml gates when ui changed, in the Linux image', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: true },
      changedFiles: ['app/css/theme.css'],
      linux: true,
    });
    await predict(h.context, h.deps);
    const visual = h.playwright.filter((p) => p.args.includes('tests/visual/visual.spec.ts'));
    expect(visual.map((p) => p.project).sort()).toEqual(['chromium', 'chromium-mobile']);
  });

  it('does not run the visual spec on the host, whose baselines CI never gates', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: true },
      changedFiles: ['app/css/theme.css'],
    });
    const { rows } = await predict(h.context, h.deps);
    expect(h.playwright.some((p) => p.args.includes('tests/visual/visual.spec.ts'))).toBe(false);
    expect(row(rows, 'e2e-visual-chromium (chromium)')?.verdict).toBe('partial');
    expect(row(rows, 'e2e-visual-chromium (chromium)')?.why).toContain('--linux');
  });

  it('keeps specs outside the ci.yml functional scope out of the functional e2e job', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: true },
      changedFiles: ['tests/visual/visual.spec.ts', LINKS_SPEC],
      linux: true,
    });
    h.context.specProjects = new Map([
      ...specProjects,
      ['tests/visual/visual.spec.ts', new Set(['chromium', 'chromium-mobile'])],
    ]);
    await predict(h.context, h.deps);
    const functional = h.playwright.filter((p) => p.args.includes(LINKS_SPEC));
    expect(functional.length).toBeGreaterThan(0);
    for (const call of functional) expect(call.args).not.toContain('tests/visual/visual.spec.ts');
  });

  it('reuses the existing build when asked, and still runs the budget gates', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [],
      skipBuild: true,
    });
    await predict(h.context, h.deps);
    const cmds = h.commands.map((c) => c.cmd.trim());
    expect(cmds).not.toContain('pnpm build');
    expect(cmds).toContain('node scripts/check-route-js.mjs');
  });

  it('marks a failed job and withholds the jobs that need it, the way CI does', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [],
      failing: /^pnpm typecheck$/,
    });
    const { rows, failed } = await predict(h.context, h.deps);
    expect(row(rows, 'typecheck')?.verdict).toBe('fail');
    expect(row(rows, 'build')?.verdict).toBe('not-run');
    expect(row(rows, 'build')?.why).toContain('typecheck');
    expect(row(rows, 'ci-gate')?.verdict).toBe('fail');
    expect(failed).toBe(true);
    expect(h.commands.some((c) => c.cmd.trim() === 'pnpm build')).toBe(false);
  });

  it('withholds every job downstream of a failure, including the ones two hops away', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: true },
      changedFiles: [LINKS_SPEC],
      failing: /^pnpm typecheck$/,
    });
    const { rows } = await predict(h.context, h.deps);
    for (const job of ['build', 'performance', 'e2e-visual-chromium', 'e2e-functional']) {
      expect(row(rows, job)?.verdict, job).toBe('not-run');
    }
    expect(h.playwright).toHaveLength(0);
  });

  it('reports a server that never starts as a failed job, not a crash', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: true },
      changedFiles: [LINKS_SPEC],
    });
    h.deps.ensureServer = async () => {
      throw new Error('the production server did not answer on :1');
    };
    const { rows, failed } = await predict(h.context, h.deps);
    expect(failed).toBe(true);
    expect(row(rows, 'e2e-visual-chromium (chromium)')?.why).toContain('did not answer');
  });

  it('reports the GitHub-only jobs as not run instead of passing them', async () => {
    const h = harness({ categories: { ai: false, app: false, ui: false }, changedFiles: [] });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'dependency-review')?.verdict).toBe('not-run');
    expect(row(rows, 'semgrep')?.verdict).toBe('not-run');
    expect(row(rows, 'performance')?.verdict).toBe('skipped');
  });

  it('prints the live eval command when ai paths changed and runs it only on request', async () => {
    const dry = harness({
      categories: { ai: true, app: true, ui: false },
      changedFiles: ['lib/ask/x.ts'],
    });
    const dryRun = await predict(dry.context, dry.deps);
    expect(row(dryRun.rows, 'ai-eval')?.verdict).toBe('not-run');
    expect(dryRun.notes.join('\n')).toContain('pnpm ask:eval');

    const live = harness({
      categories: { ai: true, app: true, ui: false },
      changedFiles: ['lib/ask/x.ts'],
      evalLive: true,
    });
    live.context.evalRun = { linkedCheckout: '/linked', workdir: '/work' };
    const liveRun = await predict(live.context, live.deps);
    expect(row(liveRun.rows, 'ai-eval')?.verdict).toBe('pass');
    expect(live.commands.some((c) => c.cmd.includes('vercel@') && c.cmd.includes('env run'))).toBe(
      true,
    );
  });

  it('scans for secrets with the local binary and does not try to install the pinned one', async () => {
    const h = harness({ categories: { ai: false, app: false, ui: false }, changedFiles: [] });
    const { rows } = await predict(h.context, h.deps);
    const cmds = h.commands.map((c) => c.cmd);
    expect(cmds.some((cmd) => cmd.includes('gitleaks git .'))).toBe(true);
    expect(cmds.some((cmd) => cmd.includes('sudo'))).toBe(false);
    expect(row(rows, 'gitleaks')?.verdict).toBe('pass');
  });

  it('reports the secret scan as not reproducible when gitleaks is not installed', async () => {
    const h = harness({ categories: { ai: false, app: false, ui: false }, changedFiles: [] });
    h.deps.commandExists = () => false;
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'gitleaks')?.verdict).toBe('partial');
    expect(row(rows, 'gitleaks')?.why).toContain('gitleaks is not installed');
  });

  it('renders one table row per predicted job', async () => {
    const h = harness({ categories: { ai: false, app: false, ui: false }, changedFiles: [] });
    const { rows } = await predict(h.context, h.deps);
    const table = summaryTable(rows);
    for (const job of ['quality-fast', 'build', 'ci-gate']) expect(table).toContain(job);
  });
});

describe('Linux runs', () => {
  it('starts a session container from the image for the installed Playwright version', () => {
    const args = dockerSessionArgs({ name: 'ci-predict-1', root: '/repo', version: '1.65.0' });
    expect(args).toContain('mcr.microsoft.com/playwright:v1.65.0-noble');
    expect(args.join(' ')).toContain('-v /repo:/host:ro');
    expect(args).toContain('--ipc=host');
    expect(args).toContain('ci-predict-1');
  });

  it('runs Playwright inside the session against a localhost origin, never the host alias', () => {
    const args = dockerExecPlaywrightArgs({
      name: 'ci-predict-1',
      baseUrl: 'http://localhost:3000',
      args: ['--project=webkit-mobile', '--retries=0', LINKS_SPEC],
    });
    expect(args.slice(0, 2)).toEqual(['exec', '-w']);
    expect(args).toContain('E2E_BASE_URL=http://localhost:3000');
    expect(args).toContain('CI=true');
    expect(args.join(' ')).not.toContain('host.docker.internal');
    expect(args.slice(-4)).toEqual(['test', '--project=webkit-mobile', '--retries=0', LINKS_SPEC]);
  });

  it('skips the browser install step because the image ships the browsers', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [LINKS_SPEC],
      linux: true,
    });
    await predict(h.context, h.deps);
    expect(h.commands.some((c) => c.cmd.includes('install-playwright-browsers'))).toBe(false);
  });
});

describe('evalCommand', () => {
  it('runs the eval with the linked checkout env, pinned CLI, and the working tree as the code under test', () => {
    const cmd = evalCommand({ linkedCheckout: '/linked', workdir: '/work' });
    expect(cmd).toMatch(/^cd '\/linked' && npx -y vercel@\d+\.\d+\.\d+ env run -- sh -c /);
    expect(cmd).toContain("cd '/work' && pnpm ask:eval");
  });
});
