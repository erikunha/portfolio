import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { EVAL_PUBLISH_ENV } from '@/lib/eval/publish-gate';

type Env = Record<string, string>;
type Step = { name?: string; if?: string; run?: string; env?: Env };
type Job = { env?: Env; steps: Step[] };
type Workflow = { env?: Env; jobs: Record<string, Job> };

const WORKFLOWS_DIR = join(process.cwd(), '.github', 'workflows');
const SCHEDULED = [
  { file: 'ask-eval.yml', command: 'pnpm ask:eval' },
  { file: 'agent-eval.yml', command: 'pnpm eval:agents' },
] as const;
const RESTRICTED_SECRET = {
  UPSTASH_REDIS_REST_URL: 'secrets.EVAL_PUBLISH_REDIS_REST_URL',
  UPSTASH_REDIS_REST_TOKEN: 'secrets.EVAL_PUBLISH_REDIS_REST_TOKEN',
} as const;
const REDIS_ENV_NAMES = Object.keys(RESTRICTED_SECRET) as Array<keyof typeof RESTRICTED_SECRET>;
const PRODUCTION_SECRET = /secrets\.UPSTASH_REDIS_REST_(URL|TOKEN)\b/;
const MAIN_ONLY = /github\.ref\s*==\s*'refs\/heads\/main'/;

// behavioral-test-allow: the workflow files are the artifact under test; which secret a scheduled job reads and on which ref it publishes has no runtime surface in this repository.
const readWorkflow = (file: string): string => readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
const load = (file: string): Workflow => parse(readWorkflow(file)) as Workflow;

const envMaps = (workflow: Workflow): Env[] => [
  workflow.env ?? {},
  ...Object.values(workflow.jobs).flatMap((job) => [
    job.env ?? {},
    ...job.steps.map((step) => step.env ?? {}),
  ]),
];

const evalStepIndex = (job: Job, command: string): number =>
  job.steps.findIndex((step) => step.run?.trim() === command);

describe('scheduled eval publishing uses only the restricted Redis user, and only from main', () => {
  it.each(SCHEDULED)(
    '$file maps the Redis env only from the EVAL_PUBLISH_REDIS_* secrets',
    ({ file }) => {
      const mapped = envMaps(load(file)).flatMap((env) =>
        REDIS_ENV_NAMES.filter((name) => name in env).map((name) => ({ name, value: env[name] })),
      );
      expect(mapped.length).toBeGreaterThan(0);
      for (const { name, value } of mapped) expect(value).toContain(RESTRICTED_SECRET[name]);
    },
  );

  it('no workflow reads the production Upstash token', () => {
    const offenders = readdirSync(WORKFLOWS_DIR)
      .filter((file) => /\.ya?ml$/.test(file))
      .filter((file) => PRODUCTION_SECRET.test(readWorkflow(file)));
    expect(offenders).toEqual([]);
  });

  it.each(SCHEDULED)('$file sets the publish flag only for refs/heads/main', ({ file }) => {
    const flags = envMaps(load(file))
      .filter((env) => EVAL_PUBLISH_ENV in env)
      .map((env) => env[EVAL_PUBLISH_ENV]);
    expect(flags.length).toBeGreaterThan(0);
    for (const flag of flags) expect(flag).toMatch(MAIN_ONLY);
  });

  it.each(SCHEDULED)(
    '$file hands the eval step the Redis credentials only while publishing',
    ({ file, command }) => {
      const job = Object.values(load(file).jobs)[0];
      const step = job?.steps[evalStepIndex(job, command)];
      for (const name of REDIS_ENV_NAMES) expect(step?.env?.[name]).toContain(EVAL_PUBLISH_ENV);
    },
  );

  it.each(SCHEDULED)(
    '$file fails on empty publish credentials before the eval step runs',
    ({ file, command }) => {
      const job = Object.values(load(file).jobs)[0];
      expect(job).toBeDefined();
      if (!job) return;
      const evalAt = evalStepIndex(job, command);
      const preflightAt = job.steps.findIndex(
        (step) =>
          REDIS_ENV_NAMES.every((name) => step.run?.includes(`-z "$${name}"`)) &&
          step.run?.includes('exit 1'),
      );
      expect(evalAt).toBeGreaterThan(-1);
      expect(preflightAt).toBeGreaterThan(-1);
      expect(preflightAt).toBeLessThan(evalAt);
      const preflight = job.steps[preflightAt];
      expect(preflight?.if ?? '').toContain(EVAL_PUBLISH_ENV);
      for (const name of REDIS_ENV_NAMES) {
        expect(preflight?.env?.[name]).toContain(RESTRICTED_SECRET[name]);
      }
    },
  );
});
