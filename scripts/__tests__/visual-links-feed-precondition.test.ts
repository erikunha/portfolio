import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CI_BUILD_ENV, SERVER, STAGES } from '../ci/ci-full-stages';
import { parseWorkflow } from '../ci/ci-workflow';

const ROOT = process.cwd();
const FIXTURE_ENV = 'E2E_LINKS_FEED_FIXTURE';
const FIXTURE_PATH = 'tests/e2e/fixtures/links-feed.json';
const BUILD_STEP = /^pnpm build\b/;
const START_STEP = /^pnpm start\b/;
const SERVER_START_STEPS = 3;
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const VISUAL_SPEC = read('tests/visual/visual.spec.ts');
const HELPER = read('tests/e2e/_helpers/links-feed-fixture.ts');
const ci = parseWorkflow(read('.github/workflows/ci.yml'));

const commandSteps = Object.values(ci.jobs).flatMap((job) =>
  job.steps
    .filter((step) => /^pnpm (build|start)\b/.test(step.run?.trim() ?? ''))
    .map((step) => ({ job: job.id, run: step.run?.trim() ?? '', env: step.env })),
);

describe('the links-en baseline depends on the links feed fixture', () => {
  it('names the same fixture in the helper, ci.yml and ci:full, and the file exists', () => {
    expect(HELPER).toContain(`'${FIXTURE_ENV}'`);
    expect(HELPER).toContain(`'${FIXTURE_PATH}'`);
    expect(CI_BUILD_ENV[FIXTURE_ENV]).toBe(FIXTURE_PATH);
    expect(() => read(FIXTURE_PATH)).not.toThrow();
  });

  it('is asserted inside visual.spec.ts, so no way of running the spec skips it', () => {
    expect(VISUAL_SPEC).toMatch(/name: 'links-en'[^}]*needsLinksFeedFixture: true/);
    expect(VISUAL_SPEC).toMatch(
      /if \('needsLinksFeedFixture' in baseline\) await expectLinksFeedFixture\(/,
    );
    const gotoAt = VISUAL_SPEC.indexOf('await gotoSettled(mockedPage, path)');
    const guardAt = VISUAL_SPEC.indexOf('await expectLinksFeedFixture(');
    const snapshotAt = VISUAL_SPEC.indexOf('await snapshotLocator(mockedPage, region');
    expect(gotoAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(gotoAt);
    expect(snapshotAt).toBeGreaterThan(guardAt);
  });

  it('says which variable to set and to rebuild when the build lacks it', () => {
    expect(HELPER).toContain('LINKS_FEED_FIXTURE_ENV');
    expect(HELPER).toContain('rebuild with it set');
  });

  it('is not a separate spec that a run of visual.spec.ts would leave out', () => {
    expect(() => read('tests/visual/links-feed-fixture.spec.ts')).toThrow();
  });
});

describe('every build and server start sets the fixture the same way', () => {
  it('finds the build step and the server starts of ci.yml', () => {
    expect(commandSteps.filter(({ run }) => BUILD_STEP.test(run))).toHaveLength(1);
    expect(commandSteps.filter(({ run }) => START_STEP.test(run))).toHaveLength(SERVER_START_STEPS);
  });

  it.each(commandSteps)('sets it in $job: $run', ({ env }) => {
    expect(env[FIXTURE_ENV]).toBe(CI_BUILD_ENV[FIXTURE_ENV]);
  });

  it('gives the ci:full build stage and its server the same value', () => {
    const build = STAGES.find((stage) => stage.id === 'build');
    const command = build?.command({} as Parameters<NonNullable<typeof build>['command']>[0]);
    expect(command?.env?.[FIXTURE_ENV]).toBe(CI_BUILD_ENV[FIXTURE_ENV]);
    expect(SERVER.command.env?.[FIXTURE_ENV]).toBe(CI_BUILD_ENV[FIXTURE_ENV]);
  });
});
