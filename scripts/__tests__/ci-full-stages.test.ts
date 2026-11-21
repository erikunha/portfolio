import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../playwright.config';
import {
  chainLeaves,
  commandText,
  coveredByCi,
  DEFAULT_BASE,
  LINUX_GATE_COMPONENT_SPECS,
  LINUX_GATE_SPECS,
  LINUX_NOT_RUN,
  LINUX_PROJECTS,
  LINUX_STAGES,
  lighthouseConfig,
  linuxStages,
  NOT_RUN,
  QUALITY_FAST_CI_ONLY_STEPS,
  SERVER,
  STAGES,
  type Stage,
  type StageContext,
  UNMIRRORED_CI_STEPS,
  WORKERS,
} from '../ci/ci-full-stages';
import { parseWorkflow } from '../ci/ci-workflow';

const ROOT = process.cwd();
const ci = parseWorkflow(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

const CTX: StageContext = {
  root: ROOT,
  base: 'origin/main',
  port: 4321,
  origin: 'http://localhost:4321',
  workDir: '/tmp/ci-full-test',
};

const MIRRORED_JOBS = [
  'quality-fast',
  'typecheck',
  'test',
  'build',
  'performance',
  'e2e-functional',
  'e2e-visual-chromium',
  'gitleaks',
  'semgrep',
];
const ES_COMPONENTS_SUFFIX = '-components';
const MATRIX_PROJECT = /\$\{\{ matrix\.project \}\}/g;
const MATRIX_SHARD = / --shard=\$\{\{ matrix\.shard \|\| '1\/1' \}\}/;
const SECRET_REFERENCE = /\$\{\{\s*secrets\./;
const ids = STAGES.map((stage) => stage.id);
const stage = (id: string): Stage => {
  const found = STAGES.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no stage ${id}`);
  return found;
};

function ciRuns(jobId: string): { name: string; run: string }[] {
  return (ci.jobs[jobId]?.steps ?? []).flatMap((step) =>
    step.run === undefined ? [] : [{ name: step.name ?? step.run.trim(), run: step.run.trim() }],
  );
}

describe('stage order', () => {
  it('has unique ids and starts with the cheapest whole-repository check', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('ci-local');
  });

  it('builds before any stage that serves the build, and serves nothing before it', () => {
    const buildAt = ids.indexOf('build');
    expect(buildAt).toBeGreaterThan(-1);
    for (const candidate of STAGES) {
      if (candidate.server === true) expect(ids.indexOf(candidate.id)).toBeGreaterThan(buildAt);
    }
    expect(STAGES.slice(0, buildAt).some((candidate) => candidate.server === true)).toBe(false);
  });

  it('runs the bundle and route gates right after the build, before any browser', () => {
    const firstServer = STAGES.findIndex((candidate) => candidate.server === true);
    expect(ids.indexOf('bundle-check')).toBeGreaterThan(ids.indexOf('build'));
    expect(ids.indexOf('bundle-check')).toBeLessThan(firstServer);
    expect(ids.indexOf('route-js-check')).toBeLessThan(firstServer);
  });

  it('runs the verify chain once: ci:local already holds the no-dashes gate', () => {
    expect(chainLeaves(pkg.scripts, 'ci:local')).toContain('pnpm check:no-dashes');
    expect(ids).not.toContain('no-dashes');
  });
});

describe('every ci.yml job is run or declared not-run', () => {
  const jobIds = Object.keys(ci.jobs);
  const covered = new Set([
    ...STAGES.flatMap((candidate) => candidate.jobs),
    ...NOT_RUN.flatMap((entry) => (entry.job === undefined ? [] : [entry.job])),
  ]);

  it('leaves no ci.yml job without a stage or a reasoned not-run entry', () => {
    expect(
      jobIds.filter((id) => !covered.has(id)),
      'a job added to ci.yml must get a stage or a NOT_RUN entry in scripts/ci/ci-full-stages.ts',
    ).toEqual([]);
  });

  it('names no job that ci.yml no longer has', () => {
    expect([...covered].filter((id) => !jobIds.includes(id))).toEqual([]);
  });

  it('declares the aggregator and the paid eval as not-run, each with a reason', () => {
    const declared = new Map(NOT_RUN.map((entry) => [entry.id, entry]));
    for (const id of ['ci-gate', 'ai-eval', 'ask:eval']) {
      expect(declared.get(id)?.reason.length ?? 0, id).toBeGreaterThan(10);
    }
    expect(declared.get('ci-gate')?.job).toBe('ci-gate');
    expect(declared.get('ai-eval')?.job).toBe('ai-eval');
  });

  it('never gives a paid eval a stage', () => {
    const commands = STAGES.map((candidate) => commandText(candidate.command(CTX)));
    expect(commands.filter((text) => /ask:eval/.test(text))).toEqual([]);
  });

  it('points every not-run package script at a script that exists', () => {
    expect(pkg.scripts['ask:eval']).toBeDefined();
  });
});

describe('every ci.yml run step has a counterpart', () => {
  const steps = MIRRORED_JOBS.flatMap((job) => ciRuns(job).map((step) => ({ job, ...step })));
  const mirrors = new Set(STAGES.flatMap((candidate) => candidate.mirrors));
  const stageSteps = new Set(STAGES.flatMap((candidate) => candidate.steps));
  const leaves = chainLeaves(pkg.scripts, 'ci:local');

  const appliesTo = (run: string, project: string, functional: boolean): boolean => {
    const components = project.endsWith(ES_COMPONENTS_SUFFIX);
    if (!functional) return true;
    return run.includes('tests/e2e/') ? !components : components;
  };

  const expandedE2e = (job: string): string[] => {
    const matrix = ci.jobs[job]?.matrixProjects ?? [];
    return ciRuns(job)
      .filter((step) => step.run.includes('matrix.project') && step.run.includes('playwright test'))
      .filter((step) => !step.run.includes('--update-snapshots'))
      .flatMap((step) =>
        matrix
          .filter((project) => appliesTo(step.run, project, job === 'e2e-functional'))
          .map((project) =>
            step.run.replace(MATRIX_SHARD, '').replace(MATRIX_PROJECT, project).trim(),
          ),
      );
  };

  it('finds the steps it checks', () => {
    expect(steps.length).toBeGreaterThan(25);
  });

  it('mirrors each run step by a stage, by the verify chain, or by a named exception', () => {
    const unmatched = steps
      .filter(({ run, name }) => {
        if (run.includes('matrix.project')) return false;
        if (mirrors.has(run) || stageSteps.has(name)) return false;
        if (UNMIRRORED_CI_STEPS.has(name)) return false;
        if (QUALITY_FAST_CI_ONLY_STEPS.has(name)) return false;
        return !leaves.some((leaf) => coveredByCi(leaf, [run], pkg.scripts));
      })
      .map(({ job, name }) => `${job}: ${name}`);
    expect(
      unmatched,
      'a CI step with no local counterpart passes locally and fails in CI. Give it a stage, or an UNMIRRORED_CI_STEPS entry with its reason',
    ).toEqual([]);
  });

  it('keeps no exception for a step that no longer exists', () => {
    const names = new Set(steps.map((step) => step.name));
    expect([...UNMIRRORED_CI_STEPS.keys()].filter((name) => !names.has(name))).toEqual([]);
  });

  it('runs every Playwright project of the functional matrix exactly as ci.yml does', () => {
    const expected = expandedE2e('e2e-functional');
    expect(expected.length).toBe(ci.jobs['e2e-functional']?.matrixProjects.length);
    const have = STAGES.flatMap((candidate) => candidate.mirrors).filter(
      (text) => text.includes('--project=') && !text.includes('tests/visual/'),
    );
    expect([...expected].sort()).toEqual([...have].sort());
  });

  it('runs every project of the visual matrix exactly as ci.yml does', () => {
    const expected = expandedE2e('e2e-visual-chromium');
    const have = STAGES.flatMap((candidate) => candidate.mirrors).filter((text) =>
      text.includes('tests/visual/'),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect([...expected].sort()).toEqual([...have].sort());
  });

  it('runs every Playwright project of the config in some stage', () => {
    const run = new Set(
      STAGES.flatMap((candidate) => candidate.mirrors).flatMap((text) => {
        const project = /--project=(\S+)/.exec(text)?.[1];
        return project === undefined ? [] : [project];
      }),
    );
    const projects = (config.projects ?? []).map((project) => project.name ?? '');
    expect(projects.filter((name) => !run.has(name))).toEqual([]);
  });

  it('mirrors the per-job commands with the exact text', () => {
    for (const [job, name] of [
      ['build', 'Build'],
      ['build', 'Bundle size gate'],
      ['build', 'Per-route JS budget gate'],
      ['test', 'Dependency vulnerability audit'],
      ['test', 'Mutation runner canary (Stryker must kill mutants in a known file)'],
      ['performance', 'Lighthouse CI (desktop)'],
      ['performance', 'Lighthouse CI (mobile)'],
      ['performance', 'axe-core a11y scan'],
    ] as const) {
      const run = ciRuns(job).find((step) => step.name === name)?.run;
      expect(run, `${job}/${name}`).toBeDefined();
      expect(mirrors.has(run ?? ''), `${job}/${name}: ${run}`).toBe(true);
    }
  });
});

describe('stage commands', () => {
  it('runs ci:local as the whole verify chain', () => {
    expect(commandText(stage('ci-local').command(CTX))).toBe('pnpm ci:local');
  });

  it('lints commits over the range from the base to HEAD and scans the whole history for secrets', () => {
    expect(commandText(stage('commitlint').command(CTX))).toContain('--from origin/main --to HEAD');
    const gitleaks = commandText(stage('gitleaks').command(CTX));
    expect(gitleaks).toContain('--full-history HEAD');
    expect(gitleaks).toContain('--config .gitleaks.toml');
    expect(stage('gitleaks').requires).toBe('gitleaks');
  });

  it('checks the scanner pins and the mutation canary with the package scripts CI uses', () => {
    expect(commandText(stage('tool-pins').command(CTX))).toBe('pnpm check:tool-pins');
    expect(commandText(stage('mutation-canary').command(CTX))).toBe(
      'pnpm exec tsx scripts/gates/check-mutation-kills.ts --canary',
    );
  });

  it('builds with the non-secret env of the CI build step and none of its secrets', () => {
    const buildStep = (ci.jobs.build?.steps ?? []).find((step) => step.name === 'Build');
    const plain = Object.entries(buildStep?.env ?? {}).filter(
      ([, value]) => !SECRET_REFERENCE.test(value),
    );
    expect(plain.length).toBeGreaterThan(0);
    const env = stage('build').command(CTX).env ?? {};
    for (const [key, value] of plain) expect(env[key], key).toBe(value);
    const secrets = Object.entries(buildStep?.env ?? {}).filter(([, value]) =>
      SECRET_REFERENCE.test(value),
    );
    for (const [key] of secrets) expect(env[key], key).toBeUndefined();
  });

  it('serves the build with the env CI gives the preview server, on the port it was given', () => {
    const startStep = (ci.jobs.performance?.steps ?? []).find(
      (step) => step.name === 'Start preview server',
    );
    expect(startStep?.run).toBe('pnpm start > /tmp/server-perf.log 2>&1 &');
    expect(SERVER.command).toEqual({ file: 'pnpm', args: ['start'], env: startStep?.env });
    expect(SERVER.portEnv).toBe('PORT');
  });

  it('runs each functional Playwright project alone, two workers, on the origin it was given', () => {
    const functional = STAGES.filter((candidate) => candidate.id.startsWith('e2e-'));
    expect(functional.length).toBe(ci.jobs['e2e-functional']?.matrixProjects.length);
    for (const candidate of functional) {
      const command = candidate.command(CTX);
      expect(commandText(command)).toBe(`${candidate.mirrors[0]} --workers=${WORKERS}`);
      expect(command.env).toMatchObject({ CI: 'true', E2E_BASE_URL: CTX.origin });
      expect(candidate.server).toBe(true);
    }
  });

  it('runs the accessibility scan and the visual specs against the served build', () => {
    expect(commandText(stage('a11y').command(CTX))).toBe(
      `pnpm playwright test tests/a11y --workers=${WORKERS}`,
    );
    for (const project of ['chromium', 'chromium-mobile']) {
      const visual = stage(`visual-${project}`);
      expect(commandText(visual.command(CTX))).toBe(
        `pnpm playwright test --project=${project} tests/visual/visual.spec.ts --workers=${WORKERS}`,
      );
      expect(visual.command(CTX).env?.ARGOS_TOKEN).toBeUndefined();
      expect(visual.server).toBe(true);
    }
  });

  it('runs the design-system components spec on chromium without the CI switch that ignores it', () => {
    const spec = stage('design-system-components');
    const command = spec.command(CTX);
    expect(commandText(command)).toContain('tests/e2e/design-system-components.spec.ts');
    expect(commandText(command)).toContain('--project=chromium');
    expect(command.env?.CI).toBeUndefined();
    expect(existsSync(join(ROOT, 'tests/e2e/design-system-components.spec.ts'))).toBe(true);
    expect(spec.jobs).toEqual([]);
  });

  it('runs Lighthouse for desktop then mobile from a derived config in the work directory', () => {
    const desktop = commandText(stage('lhci-desktop').command(CTX));
    const mobile = commandText(stage('lhci-mobile').command(CTX));
    expect(desktop).toContain(`--config=${CTX.workDir}/lighthouserc.json`);
    expect(mobile).toContain(`--config=${CTX.workDir}/lighthouserc.mobile.json`);
    expect(ids.indexOf('lhci-desktop')).toBeLessThan(ids.indexOf('lhci-mobile'));
    expect(stage('lhci-desktop').server).toBe(true);
  });

  it('defaults the base to the remote main branch', () => {
    expect(DEFAULT_BASE).toBe('origin/main');
  });
});

describe('lighthouseConfig', () => {
  const SOURCE = {
    ci: {
      collect: { url: ['http://localhost:3000', 'http://localhost:3000/cv'], numberOfRuns: 2 },
      assert: { assertions: { 'categories:seo': ['error', { minScore: 1 }] } },
      upload: { target: 'temporary-public-storage' },
    },
  };

  it('points every url at the served port and keeps the path', () => {
    const derived = lighthouseConfig(SOURCE, 4321, '/tmp/out');
    expect(derived.ci.collect.url).toEqual(['http://localhost:4321', 'http://localhost:4321/cv']);
  });

  it('keeps the assertions and the collect settings untouched', () => {
    const derived = lighthouseConfig(SOURCE, 4321, '/tmp/out');
    expect(derived.ci.assert).toEqual(SOURCE.ci.assert);
    expect(derived.ci.collect.numberOfRuns).toBe(2);
  });

  it('writes the report to disk instead of uploading it', () => {
    const derived = lighthouseConfig(SOURCE, 4321, '/tmp/out');
    expect(derived.ci.upload).toEqual({ target: 'filesystem', outputDir: '/tmp/out' });
  });

  it('does not change the config it was given', () => {
    lighthouseConfig(SOURCE, 4321, '/tmp/out');
    expect(SOURCE.ci.upload.target).toBe('temporary-public-storage');
    expect(SOURCE.ci.collect.url[0]).toBe('http://localhost:3000');
  });

  it.each(['lighthouserc.json', 'lighthouserc.mobile.json'])(
    'sends nothing to public storage from the real %s',
    (file) => {
      const real = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
      const derived = JSON.stringify(lighthouseConfig(real, 4321, '/tmp/out'));
      expect(derived).not.toContain('temporary-public-storage');
      expect(derived).not.toContain('localhost:3000');
      expect(derived).toContain('localhost:4321');
    },
  );
});

describe('linux stages', () => {
  const E2E_JOB = 'e2e-functional';
  const PAGE_SPEC_ROOT = 'tests/e2e/';
  const matrix = ci.jobs[E2E_JOB]?.matrixProjects ?? [];
  const projectOf = (candidate: Stage): string =>
    /--project=(\S+)/.exec(commandText(candidate.command(CTX)))?.[1] ?? '';

  it('keeps the default run free of any linux stage', () => {
    expect(ids.filter((id) => id.startsWith('linux-'))).toEqual([]);
    expect(STAGES.some((candidate) => candidate.command(CTX).file === 'docker')).toBe(false);
  });

  it('declares the linux e2e stages not-run, with the flag that runs them, outside the default list', () => {
    expect(LINUX_NOT_RUN.id).toBe('linux e2e');
    expect(LINUX_NOT_RUN.reason).toContain('--linux');
    expect(NOT_RUN).not.toContain(LINUX_NOT_RUN);
  });

  it('has the five stages, WebKit first and Chromium last, each with a unique id', () => {
    expect(LINUX_STAGES.map((candidate) => candidate.id)).toEqual([
      'linux-e2e-webkit-desktop',
      'linux-e2e-webkit-mobile',
      'linux-e2e-webkit-desktop-components',
      'linux-e2e-webkit-mobile-components',
      'linux-e2e-chromium',
    ]);
    expect(new Set(LINUX_STAGES.map((candidate) => candidate.id)).size).toBe(LINUX_STAGES.length);
  });

  it('mirrors one project of the ci.yml functional matrix per stage', () => {
    for (const candidate of LINUX_STAGES) {
      const project = candidate.id.replace('linux-e2e-', '');
      expect(matrix, candidate.id).toContain(project);
      expect(candidate.jobs).toEqual([E2E_JOB]);
      expect(candidate.mirrors[0]).toContain(`--project=${project}`);
      expect(projectOf(candidate)).toBe(project);
    }
    expect(LINUX_PROJECTS.every((project) => matrix.includes(project))).toBe(true);
  });

  it('covers every project of the ci.yml functional matrix in the all scope, and five of them otherwise', () => {
    const projectsOf = (scope: 'gate' | 'changed' | 'all'): string[] =>
      linuxStages(scope, 1).map((candidate) => candidate.id.replace('linux-e2e-', ''));
    expect([...projectsOf('all')].sort()).toEqual([...matrix].sort());
    expect(projectsOf('gate')).toEqual(LINUX_PROJECTS);
    expect(projectsOf('changed')).toEqual(LINUX_PROJECTS);
    expect(projectsOf('all').slice(0, LINUX_PROJECTS.length)).toEqual(LINUX_PROJECTS);
    expect(projectsOf('all').slice(LINUX_PROJECTS.length)).toEqual([
      'chromium-mobile',
      'chromium-components',
      'chromium-mobile-components',
    ]);
  });

  it('runs the three extra projects whole as CI does, each a stage that serves and needs docker', () => {
    const extra = linuxStages('all', 1).slice(LINUX_PROJECTS.length);
    expect(extra).toHaveLength(3);
    for (const candidate of extra) {
      const project = candidate.id.replace('linux-e2e-', '');
      const text = commandText(candidate.command(CTX));
      expect(candidate.mirrors[0]).toContain(`--project=${project}`);
      expect(candidate.server).toBe(true);
      expect(candidate.requires).toBe('docker');
      expect(text).toContain(`--project=${project} `);
      if (project.endsWith('-components'))
        expect(text.trimEnd().endsWith('--output=/results')).toBe(true);
      else expect(text.endsWith('--output=/results tests/e2e/')).toBe(true);
    }
  });

  it('runs after every macOS stage, serves the build and needs docker', () => {
    const lastMac = Math.max(ids.indexOf('lhci-mobile'), ids.indexOf('lhci-desktop'));
    expect(lastMac).toBe(ids.length - 1);
    for (const candidate of LINUX_STAGES) {
      expect(candidate.server).toBe(true);
      expect(candidate.requires).toBe('docker');
      expect(candidate.unavailable).toBeTypeOf('function');
    }
  });

  it('runs each stage with the same worker count as the macOS stages, on the port it was given', () => {
    for (const candidate of LINUX_STAGES) {
      const text = commandText(candidate.command(CTX));
      expect(text).toContain(`--workers=${WORKERS}`);
      expect(text).toContain(`-e E2E_BASE_URL=${CTX.origin}`);
    }
  });

  it('names a gate spec that exists for every page and component project', () => {
    for (const spec of [...LINUX_GATE_SPECS, ...LINUX_GATE_COMPONENT_SPECS]) {
      expect(existsSync(join(ROOT, spec)), spec).toBe(true);
    }
    expect(LINUX_GATE_SPECS.every((spec) => spec.startsWith(PAGE_SPEC_ROOT))).toBe(true);
    expect(LINUX_GATE_SPECS).toContain('tests/e2e/drawer-dialog.spec.ts');
    expect(LINUX_GATE_SPECS).toContain('tests/e2e/drawer-exit-interactive.spec.ts');
  });

  it('puts no visual or accessibility spec in any scope', () => {
    for (const scope of ['gate', 'all'] as const) {
      for (const candidate of linuxStages(scope, 1)) {
        const text = commandText(candidate.command(CTX));
        expect(text).not.toContain('tests/visual');
        expect(text).not.toContain('tests/a11y');
      }
    }
  });

  it('runs the gate set on the page projects and the component gate on the component projects', () => {
    const page = commandText(LINUX_STAGES[0]?.command(CTX) ?? { file: '', args: [] });
    const component = commandText(LINUX_STAGES[2]?.command(CTX) ?? { file: '', args: [] });
    for (const spec of LINUX_GATE_SPECS) expect(page).toContain(spec.replaceAll('.', '\\.'));
    for (const spec of LINUX_GATE_COMPONENT_SPECS) {
      expect(component).toContain(spec.replaceAll('.', '\\.'));
    }
    expect(component).not.toContain(PAGE_SPEC_ROOT);
  });

  it('runs the whole matrix project in the all scope', () => {
    const all = linuxStages('all', 1);
    const page = commandText(all[0]?.command(CTX) ?? { file: '', args: [] });
    const component = commandText(all[2]?.command(CTX) ?? { file: '', args: [] });
    expect(page.endsWith('--project=webkit-desktop --workers=2 --output=/results tests/e2e/')).toBe(
      true,
    );
    for (const spec of LINUX_GATE_SPECS) expect(page).not.toContain(spec.replaceAll('.', '\\.'));
    expect(component.trimEnd().endsWith('--output=/results')).toBe(true);
  });
});
