import { parse } from 'yaml';

export interface RunDefaults {
  shell?: string;
  workingDirectory?: string;
}

export interface WorkflowStep {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  shell?: string;
  workingDirectory?: string;
  continueOnError: boolean;
  env: Record<string, string>;
}

export interface WorkflowJob {
  id: string;
  needs: string[];
  if?: string;
  matrixProjects: string[];
  matrixShards: Record<string, string[]>;
  defaults: RunDefaults;
  env: Record<string, string>;
  outputs: Record<string, string>;
  steps: WorkflowStep[];
}

export interface Workflow {
  jobs: Record<string, WorkflowJob>;
  order: string[];
  env: Record<string, string>;
  defaults: RunDefaults;
}

export class UnsupportedWorkflowError extends Error {}

const MATRIX_AXIS = 'project';
const MATRIX_INCLUDE = 'include';
const MATRIX_SHARD = 'shard';
const MATRIX_INCLUDE_KEYS = [MATRIX_AXIS, MATRIX_SHARD];

interface RawStep {
  id?: string;
  name?: string;
  if?: string | boolean;
  uses?: string;
  run?: string;
  shell?: string;
  'working-directory'?: string;
  'continue-on-error'?: unknown;
  env?: Record<string, unknown>;
}

interface RawDefaults {
  run?: { shell?: string; 'working-directory'?: string };
}

interface RawJob {
  needs?: string | string[];
  if?: string | boolean;
  strategy?: { matrix?: Record<string, unknown> };
  defaults?: RawDefaults;
  env?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  steps?: RawStep[];
}

const WORKFLOW_KEYS = ['name', 'on', 'concurrency', 'permissions', 'jobs', 'env', 'defaults'];
const JOB_KEYS = [
  'name',
  'runs-on',
  'permissions',
  'timeout-minutes',
  'concurrency',
  'steps',
  'if',
  'needs',
  'env',
  'strategy',
  'outputs',
  'defaults',
];
const STRATEGY_KEYS = ['matrix', 'fail-fast'];
const STEP_KEYS = [
  'id',
  'name',
  'if',
  'uses',
  'with',
  'run',
  'shell',
  'working-directory',
  'continue-on-error',
  'timeout-minutes',
  'env',
];
const DEFAULTS_KEYS = ['run'];
const DEFAULTS_RUN_KEYS = ['shell', 'working-directory'];

function allowKeys(scope: string, value: object | undefined, allowed: string[]): void {
  const unknown = Object.keys(value ?? {}).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new UnsupportedWorkflowError(
      `${scope}: "${unknown.join('", "')}" is not supported by the workflow parser; teach it or the drift guard stays blind to it`,
    );
  }
}

const stringifyRecord = (record: Record<string, unknown> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [key, String(value)]));

function runDefaults(scope: string, raw: RawDefaults | undefined): RunDefaults {
  allowKeys(`${scope} defaults`, raw, DEFAULTS_KEYS);
  allowKeys(`${scope} defaults.run`, raw?.run, DEFAULTS_RUN_KEYS);
  return {
    ...(raw?.run?.shell === undefined ? {} : { shell: raw.run.shell }),
    ...(raw?.run?.['working-directory'] === undefined
      ? {}
      : { workingDirectory: raw.run['working-directory'] }),
  };
}

function continueOnError(scope: string, value: unknown): boolean {
  if (value === undefined || value === false) return false;
  if (value === true) return true;
  throw new UnsupportedWorkflowError(`${scope}: continue-on-error must be a literal true or false`);
}

interface MatrixShape {
  projects: string[];
  shards: Record<string, string[]>;
}

function matrixShape(id: string, matrix: Record<string, unknown> | undefined): MatrixShape {
  if (matrix === undefined) return { projects: [], shards: {} };
  const axes = Object.keys(matrix).filter((axis) => axis !== MATRIX_INCLUDE);
  const listed = matrix[MATRIX_AXIS];
  const include = matrix[MATRIX_INCLUDE] ?? [];
  if (axes.length !== 1 || axes[0] !== MATRIX_AXIS || !Array.isArray(listed)) {
    throw new UnsupportedWorkflowError(
      `job ${id}: only a matrix with a single "${MATRIX_AXIS}" list and optional "${MATRIX_INCLUDE}" entries is supported (found ${Object.keys(matrix).join(', ')})`,
    );
  }
  if (!Array.isArray(include)) {
    throw new UnsupportedWorkflowError(`job ${id}: matrix "${MATRIX_INCLUDE}" must be a list`);
  }
  const projects = listed.map(String);
  const shards: Record<string, string[]> = {};
  for (const entry of include as Record<string, unknown>[]) {
    const unknown = Object.keys(entry ?? {}).filter((key) => !MATRIX_INCLUDE_KEYS.includes(key));
    const project = entry?.[MATRIX_AXIS];
    const shard = entry?.[MATRIX_SHARD];
    if (unknown.length > 0 || typeof project !== 'string' || typeof shard !== 'string') {
      throw new UnsupportedWorkflowError(
        `job ${id}: a matrix include entry takes a string "${MATRIX_AXIS}" and a string "${MATRIX_SHARD}" (found ${Object.keys(entry ?? {}).join(', ')})`,
      );
    }
    if (projects.includes(project)) {
      throw new UnsupportedWorkflowError(
        `job ${id}: matrix include entry for "${project}" would merge into the listed project, not add a shard job`,
      );
    }
    shards[project] = [...(shards[project] ?? []), shard];
  }
  return { projects: [...projects, ...Object.keys(shards)], shards };
}

function topologicalOrder(jobs: Record<string, WorkflowJob>): string[] {
  const levels = new Map<string, number>();
  const levelOf = (id: string, trail: string[]): number => {
    const known = levels.get(id);
    if (known !== undefined) return known;
    if (trail.includes(id)) throw new UnsupportedWorkflowError(`job ${id} needs itself`);
    const needs = (jobs[id]?.needs ?? []).filter((need) => need in jobs);
    const level =
      needs.length === 0 ? 0 : 1 + Math.max(...needs.map((need) => levelOf(need, [...trail, id])));
    levels.set(id, level);
    return level;
  };
  const ids = Object.keys(jobs);
  return ids
    .map((id, index) => ({ id, index, level: levelOf(id, []) }))
    .sort((a, b) => a.level - b.level || a.index - b.index)
    .map((entry) => entry.id);
}

export function parseWorkflow(text: string): Workflow {
  const document = parse(text) as {
    jobs?: Record<string, RawJob>;
    env?: Record<string, unknown>;
    defaults?: RawDefaults;
  };
  allowKeys('workflow', document, WORKFLOW_KEYS);
  const jobs: Record<string, WorkflowJob> = {};
  for (const [id, raw] of Object.entries(document.jobs ?? {})) {
    allowKeys(`job ${id}`, raw, JOB_KEYS);
    allowKeys(`job ${id} strategy`, raw.strategy, STRATEGY_KEYS);
    const matrix = matrixShape(id, raw.strategy?.matrix);
    jobs[id] = {
      id,
      needs: raw.needs === undefined ? [] : [raw.needs].flat(),
      ...(raw.if === undefined ? {} : { if: String(raw.if) }),
      matrixProjects: matrix.projects,
      matrixShards: matrix.shards,
      defaults: runDefaults(`job ${id}`, raw.defaults),
      env: stringifyRecord(raw.env),
      outputs: stringifyRecord(raw.outputs),
      steps: (raw.steps ?? []).map((step, index) => {
        const scope = `job ${id} step ${step.name ?? index + 1}`;
        allowKeys(scope, step, STEP_KEYS);
        return {
          ...(step.id === undefined ? {} : { id: step.id }),
          ...(step.name === undefined ? {} : { name: step.name }),
          ...(step.if === undefined ? {} : { if: String(step.if) }),
          ...(step.uses === undefined ? {} : { uses: step.uses }),
          ...(step.run === undefined ? {} : { run: step.run }),
          ...(step.shell === undefined ? {} : { shell: step.shell }),
          ...(step['working-directory'] === undefined
            ? {}
            : { workingDirectory: step['working-directory'] }),
          continueOnError: continueOnError(scope, step['continue-on-error']),
          env: stringifyRecord(step.env),
        };
      }),
    };
  }
  return {
    jobs,
    order: topologicalOrder(jobs),
    env: stringifyRecord(document.env),
    defaults: runDefaults('workflow', document.defaults),
  };
}
