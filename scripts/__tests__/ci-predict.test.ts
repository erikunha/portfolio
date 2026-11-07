import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  archCaveat,
  CONTAINER_ROOT,
  chainLeaves,
  chooseBase,
  coveredByCi,
  EXIT,
  HOST_MOUNT,
  JOB_POLICIES,
  serverKey,
  unclassifiedActions,
  unmappedJobs,
} from '../lib/ci-predict-policy';
import {
  type Deps,
  dockerExecPlaywrightArgs,
  dockerSessionArgs,
  type ExecRequest,
  type ExecResult,
  evalCommand,
  judge,
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
  shell?: string | undefined;
  cwd?: string | undefined;
}

const dryExec = (request: ExecRequest): ExecResult | undefined =>
  request.cmd.includes('detect-changes.mjs') ? undefined : { code: 0, output: '', dry: true };

function harness(options: {
  categories: { ai: boolean; app: boolean; ui: boolean };
  changedFiles: string[];
  failing?: RegExp;
  lockfileChanged?: boolean;
  full?: boolean;
  linux?: boolean;
  skipBuild?: boolean;
  evalLive?: boolean;
  workflow?: ReturnType<typeof parseWorkflow>;
  dryRun?: boolean;
  stamp?: { valid: boolean; reason: string };
  matches?: (pattern: string) => boolean;
}) {
  const commands: Recorded[] = [];
  const playwright: { args: string[]; project: string | undefined }[] = [];
  const servers: Record<string, string>[] = [];
  const result = (code: number): ExecResult => ({ code, output: code === 0 ? '' : 'boom' });
  const append = (file: string | undefined, text: string) => {
    if (file) writeFileSync(file, text, { flag: 'a' });
  };
  const deps: Deps = {
    exec: async (request) => {
      const { cmd, env } = request;
      commands.push({ cmd, env, shell: request.shell, cwd: request.cwd });
      if (options.dryRun === true) {
        const dry = dryExec(request);
        if (dry !== undefined) return dry;
      }
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
      return options.dryRun === true ? { code: 0, output: '', dry: true } : result(0);
    },
    ensureServer: async (env) => {
      servers.push(env);
      return { hostUrl: 'http://localhost:3401', containerUrl: 'http://host.docker.internal:3401' };
    },
    commandExists: () => true,
    anyFileMatches: options.matches ?? (() => false),
    now: () => 0,
  };
  const context: RunContext = {
    workflow: options.workflow ?? workflow,
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
      dryRun: options.dryRun === true,
      stamp: options.stamp ?? { valid: true, reason: '' },
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
    expect(row(rows, 'e2e-functional (webkit-mobile-components)')?.verdict).toBe('partial');
    expect(row(rows, 'e2e-functional (webkit-mobile-components)')?.why).toContain('--full');
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
    const args = dockerSessionArgs({
      name: 'ci-predict-1',
      root: '/repo',
      version: '1.65.0',
      owner: 4242,
    });
    expect(args).toContain('mcr.microsoft.com/playwright:v1.65.0-noble');
    expect(args.join(' ')).toContain(`-v /repo:${HOST_MOUNT}:ro`);
    expect(args).toContain('--rm');
    expect(args.join(' ')).toContain('--label ci-predict.owner=4242');
    expect(args).toContain('--ipc=host');
    expect(args).toContain('ci-predict-1');
  });

  it('runs Playwright inside the session against a localhost origin, never the host alias', () => {
    const args = dockerExecPlaywrightArgs({
      name: 'ci-predict-1',
      baseUrl: 'http://localhost:3000',
      args: ['--project=webkit-mobile', '--retries=0', LINKS_SPEC],
      env: { DEPLOY_SALT: 'ci-build-salt', E2E_BASE_URL: 'http://wrong' },
    });
    expect(args.slice(0, 3)).toEqual(['exec', '-w', CONTAINER_ROOT]);
    expect(args).toContain('E2E_BASE_URL=http://localhost:3000');
    expect(args).toContain('CI=true');
    expect(args.join(' ')).not.toContain('host.docker.internal');
    expect(args).toContain('DEPLOY_SALT=ci-build-salt');
    expect(args.filter((arg) => arg.startsWith('E2E_BASE_URL='))).toEqual([
      'E2E_BASE_URL=http://localhost:3000',
    ]);
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

const expr = (body: string) => ['$', '{{ ', body, ' }}'].join('');

const quality = (body: string) => parseWorkflow(`jobs:\n  quality-fast:\n    runs-on: x\n${body}`);

describe('step execution fidelity', () => {
  it('hands every command to the shell with its shell, working directory and merged env', async () => {
    const wf = parseWorkflow(
      [
        'env:',
        '  TOP: wf',
        'defaults:',
        '  run:',
        '    working-directory: app',
        'jobs:',
        '  quality-fast:',
        '    runs-on: x',
        '    env:',
        `      JOB: ${expr('env.TOP')}-job`,
        '    steps:',
        '      - run: echo one',
        '        env:',
        `          STEP: ${expr('env.JOB')}-step`,
        '      - run: echo two',
        '        shell: bash',
        '        working-directory: nested',
      ].join('\n'),
    );
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
    });
    await predict(h.context, h.deps);
    const one = h.commands.find((c) => c.cmd.trim() === 'echo one');
    expect(one?.env).toMatchObject({ TOP: 'wf', JOB: 'wf-job', STEP: 'wf-job-step' });
    expect(one?.cwd).toBe('app');
    expect(one?.shell).toBeUndefined();
    const two = h.commands.find((c) => c.cmd.trim() === 'echo two');
    expect(two?.shell).toBe('bash');
    expect(two?.cwd).toBe('nested');
  });

  it('reports a step with a context it cannot supply as not reproducible, not as a skipped step', async () => {
    const wf = quality(
      `    steps:\n      - run: echo ${expr('runner.os')}\n      - run: echo fine\n`,
    );
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'quality-fast')?.verdict).toBe('partial');
    expect(row(rows, 'quality-fast')?.why).toContain('runner');
    expect(h.commands.map((c) => c.cmd.trim())).toEqual(['echo fine']);
  });

  it('reports a condition it cannot evaluate as not reproducible', async () => {
    const wf = quality("    steps:\n      - if: vars.FLAG == 'on'\n        run: echo gated\n");
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'quality-fast')?.verdict).toBe('not-run');
    expect(row(rows, 'quality-fast')?.why).toContain('vars');
    expect(h.commands).toHaveLength(0);
  });

  it('does not report a job pass when no step of it executed', async () => {
    const wf = quality('    steps:\n      - uses: actions/checkout@abc123\n');
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'quality-fast')?.verdict).toBe('not-run');
    expect(row(rows, 'quality-fast')?.why).toMatch(/no step/i);
  });

  it('matches hashFiles globs through the file matcher instead of reading them literally', async () => {
    const wf = quality(
      "    steps:\n      - if: hashFiles('app/**', 'nope') != ''\n        run: echo glob\n",
    );
    const hit = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
      matches: (pattern) => pattern === 'app/**',
    });
    await predict(hit.context, hit.deps);
    expect(hit.commands.map((c) => c.cmd.trim())).toEqual(['echo glob']);
    const miss = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
    });
    await predict(miss.context, miss.deps);
    expect(miss.commands).toHaveLength(0);
  });

  it('reports a hashFiles pattern that negates as not reproducible', async () => {
    const wf = quality(
      "    steps:\n      - if: hashFiles('app/**', '!app/x') != ''\n        run: echo glob\n",
    );
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
      matches: () => true,
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'quality-fast')?.why).toContain('negates');
    expect(h.commands).toHaveLength(0);
  });

  it('reports a sudo step that is not a local tool install as not reproducible', async () => {
    const wf = quality(
      '    steps:\n      - run: sudo sysctl -w vm.max_map_count=1\n      - run: echo ok\n',
    );
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'quality-fast')?.verdict).toBe('partial');
    expect(row(rows, 'quality-fast')?.why).toContain('elevated privileges');
    expect(h.commands.some((c) => c.cmd.includes('sudo'))).toBe(false);
  });

  it('names the local binary used in place of the pinned install', async () => {
    const h = harness({ categories: { ai: false, app: false, ui: false }, changedFiles: [] });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'gitleaks')?.why).toContain('local gitleaks');
  });

  it('lets a continue-on-error step fail without failing the job, and says so', async () => {
    const wf = quality(
      '    steps:\n      - run: flaky-report\n        continue-on-error: true\n      - run: echo after\n',
    );
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
      failing: /flaky-report/,
    });
    const { rows, failed } = await predict(h.context, h.deps);
    expect(failed).toBe(false);
    expect(h.commands.map((c) => c.cmd.trim())).toEqual(['flaky-report', 'echo after']);
    expect(row(rows, 'quality-fast')?.why).toContain('continue-on-error');
  });

  it('refuses a shell it cannot reproduce rather than running the script in bash', async () => {
    const wf = quality('    steps:\n      - run: Write-Host hi\n        shell: pwsh\n');
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: false, ui: false },
      changedFiles: [],
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'quality-fast')?.verdict).toBe('not-run');
    expect(row(rows, 'quality-fast')?.why).toContain('pwsh');
  });
});

describe('narrowed and unverifiable runs', () => {
  it('marks a narrowed e2e job partial and says what CI does differently', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [LINKS_SPEC],
    });
    const { rows } = await predict(h.context, h.deps);
    const narrowed = row(rows, 'e2e-functional (webkit-mobile)');
    expect(narrowed?.verdict).toBe('partial');
    expect(narrowed?.why).toMatch(/narrowed/);
  });

  it('keeps the full suite a pass', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [],
      full: true,
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'e2e-functional (webkit-mobile)')?.verdict).toBe('pass');
  });

  it('never runs a whole project when the narrowed selection is empty for a step', async () => {
    const wf = parseWorkflow(
      [
        'jobs:',
        '  e2e-functional:',
        '    runs-on: x',
        '    strategy:',
        '      matrix:',
        '        project: [chromium]',
        '    steps:',
        '      - run: pnpm start > /tmp/s.log 2>&1 &',
        '      - run: pnpm playwright test --project=chromium-components tests/e2e/',
      ].join('\n'),
    );
    const h = harness({
      workflow: wf,
      categories: { ai: false, app: true, ui: false },
      changedFiles: [LINKS_SPEC],
    });
    const { rows } = await predict(h.context, h.deps);
    expect(h.playwright).toHaveLength(0);
    expect(row(rows, 'e2e-functional (chromium)')?.verdict).not.toBe('pass');
  });

  it('marks a reused build partial, and the servers that run on it, when no stamp matches this tree', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [LINKS_SPEC],
      skipBuild: true,
      stamp: { valid: false, reason: 'the .next was built from another commit' },
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'build')?.verdict).toBe('partial');
    expect(row(rows, 'build')?.why).toContain('another commit');
    expect(row(rows, 'e2e-functional (webkit-mobile)')?.verdict).toBe('partial');
    expect(row(rows, 'e2e-functional (webkit-mobile)')?.why).toContain('another commit');
  });

  it('reports a reused build with a matching stamp without a warning', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [],
      skipBuild: true,
    });
    const { rows } = await predict(h.context, h.deps);
    expect(row(rows, 'build')?.verdict).toBe('pass');
  });
});

describe('dry run', () => {
  it('reports would-run for everything that was not executed, and never pass', async () => {
    const h = harness({
      categories: { ai: false, app: true, ui: false },
      changedFiles: [LINKS_SPEC],
      dryRun: true,
    });
    const { rows, failed } = await predict(h.context, h.deps);
    expect(failed).toBe(false);
    expect(row(rows, 'typecheck')?.verdict).toBe('would-run');
    expect(row(rows, 'e2e-functional (webkit-mobile)')?.verdict).toBe('would-run');
    expect(row(rows, 'ci-gate')?.verdict).toBe('would-run');
    expect(rows.some((r) => r.verdict === 'pass' && r.job !== 'detect-changes')).toBe(false);
  });
});

describe('judge', () => {
  const rowOf = (verdict: Row['verdict'], job = 'x'): Row => ({ job, verdict, why: '', ms: 0 });

  it('fails on any failed job', () => {
    expect(judge([rowOf('pass'), rowOf('fail')], false)).toMatchObject({ code: EXIT.FAILED });
  });

  it('calls a dry run neither a pass nor a prediction', () => {
    const verdict = judge([rowOf('would-run'), rowOf('pass')], true);
    expect(verdict.code).toBe(EXIT.DRY_RUN);
    expect(verdict.headline).toContain('DRY RUN');
  });

  it('says NOT VERIFIED when nothing ran', () => {
    const verdict = judge([rowOf('skipped'), rowOf('not-run')], false);
    expect(verdict.code).toBe(EXIT.NOT_VERIFIED);
    expect(verdict.headline).toContain('NOT VERIFIED');
  });

  it('keeps unverified jobs out of the clean verdict and names them', () => {
    const verdict = judge(
      [rowOf('pass', 'a'), rowOf('partial', 'e2e'), rowOf('not-run', 'b')],
      false,
    );
    expect(verdict.code).toBe(EXIT.NOT_VERIFIED);
    expect(verdict.headline).toContain('no failure found in what ran');
    expect(verdict.headline).toContain('e2e');
    expect(verdict.headline).toContain('b');
  });

  it('is clean only when every job passed or was skipped by paths', () => {
    const verdict = judge([rowOf('pass'), rowOf('skipped')], false);
    expect(verdict.code).toBe(EXIT.OK);
    expect(verdict.headline).toBe('PREDICTED CI: no failure found');
  });

  it('does not count the jobs CI runs only on GitHub against a clean verdict, but lists them', () => {
    const verdict = judge(
      [rowOf('pass'), rowOf('not-run', 'dependency-review'), rowOf('not-run', 'semgrep')],
      false,
    );
    expect(verdict.code).toBe(EXIT.OK);
    expect(verdict.headline).toContain('dependency-review');
  });
});

describe('local prediction helpers', () => {
  it('picks the nearest base and refuses to guess when there is none', () => {
    expect(
      chooseBase([
        { ref: 'origin/main', ahead: 40 },
        { ref: 'origin/feat/terminal-redesign', ahead: 3 },
      ]),
    ).toBe('origin/feat/terminal-redesign');
    expect(
      chooseBase([
        { ref: 'origin/main', ahead: 2 },
        { ref: 'origin/feat/a', ahead: 2 },
      ]),
    ).toBe('origin/main');
    expect(chooseBase([])).toBeUndefined();
  });

  it('warns about the architecture CI does not run on', () => {
    expect(archCaveat('x64')).toBeUndefined();
    expect(archCaveat('arm64')).toMatch(/arm64.*x64|x64.*arm64/);
  });

  it('keys a server by its env regardless of key order, and by nothing else', () => {
    expect(serverKey({ A: '1', B: '2' })).toBe(serverKey({ B: '2', A: '1' }));
    expect(serverKey({ A: '1' })).not.toBe(serverKey({ A: '2' }));
  });
});
