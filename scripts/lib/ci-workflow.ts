import { parse } from 'yaml';

export type ExprValue = string | number | boolean | null | undefined | ExprValue[] | ExprObject;
export interface ExprObject {
  [key: string]: ExprValue;
}
export type ExprContext = ExprObject;

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

export class UnsupportedExpressionError extends Error {}

const EXPRESSION = /\$\{\{([\s\S]*?)\}\}/g;
const WRAPPED = /^\s*\$\{\{([\s\S]*)\}\}\s*$/;
const TOKEN =
  /\s*(?:('(?:[^']|'')*')|(\d+(?:\.\d+)?)|(\|\||&&|==|!=|!|\(|\)|,)|([A-Za-z_][\w-]*(?:\.(?:[A-Za-z_][\w-]*|\*))*))/y;
const SNIPPET_CHARS = 20;
const QUOTE = "'";
const ESCAPED_QUOTE = "''";
const WILDCARD = '*';
const SECRETS_PREFIX = 'secrets.';
const MATRIX_AXIS = 'project';

type Token = { kind: 'string' | 'number' | 'op' | 'path'; text: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    if (/^\s*$/.test(source.slice(position))) break;
    TOKEN.lastIndex = position;
    const match = TOKEN.exec(source);
    if (match === null) {
      throw new UnsupportedExpressionError(
        `unsupported expression syntax near "${source.slice(position, position + SNIPPET_CHARS)}"`,
      );
    }
    position = TOKEN.lastIndex;
    if (match[1] !== undefined) {
      tokens.push({ kind: 'string', text: match[1].slice(1, -1).replaceAll(ESCAPED_QUOTE, QUOTE) });
    } else if (match[2] !== undefined) {
      tokens.push({ kind: 'number', text: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ kind: 'op', text: match[3] });
    } else if (match[4] !== undefined) {
      tokens.push({ kind: 'path', text: match[4] });
    }
  }
  return tokens;
}

export function isTruthy(value: ExprValue): boolean {
  return !(value === false || value === 0 || value === '' || value === null || value === undefined);
}

function comparable(value: ExprValue): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

function lookup(path: string, ctx: ExprContext): ExprValue {
  const segments = path.split('.');
  let current: ExprValue[] | ExprValue = ctx;
  let spread = false;
  for (const segment of segments) {
    if (segment === WILDCARD) {
      // The wildcard projects over the values of an object and over the
      // elements of an array, which is what GitHub does for both:
      // `labels.*.name` over an array of label objects is the array of names,
      // and `needs.*.result` over the needs map is the array of results.
      if (current === null || typeof current !== 'object') return undefined;
      current = Object.values(current);
      spread = true;
      continue;
    }
    const step = (value: ExprValue): ExprValue =>
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value[segment]
        : undefined;
    current = spread && Array.isArray(current) ? current.map(step) : step(current as ExprValue);
  }
  return current;
}

const FUNCTIONS: Record<string, (args: ExprValue[]) => ExprValue> = {
  always: () => true,
  success: () => true,
  failure: () => false,
  cancelled: () => false,
  toJSON: ([value]) => JSON.stringify(value ?? null),
  contains: ([haystack, needle]) => {
    if (Array.isArray(haystack))
      return haystack.some((item) => comparable(item) === comparable(needle));
    return String(haystack ?? '')
      .toLowerCase()
      .includes(String(needle ?? '').toLowerCase());
  },
  startsWith: ([value, prefix]) =>
    String(value ?? '')
      .toLowerCase()
      .startsWith(String(prefix ?? '').toLowerCase()),
  endsWith: ([value, suffix]) =>
    String(value ?? '')
      .toLowerCase()
      .endsWith(String(suffix ?? '').toLowerCase()),
};

const LITERALS: Record<string, ExprValue> = { true: true, false: false, null: null };

export type ExprFunctions = Record<string, (args: ExprValue[]) => ExprValue>;

export type SecretReader = (name: string) => void;

export function evaluate(
  expression: string,
  ctx: ExprContext,
  extra: ExprFunctions = {},
  onSecret?: SecretReader,
): ExprValue {
  const tokens = tokenize(expression);
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const isOp = (text: string) => peek()?.kind === 'op' && peek()?.text === text;

  const parseOr = (): ExprValue => {
    let left = parseAnd();
    while (isOp('||')) {
      take();
      const right = parseAnd();
      left = isTruthy(left) ? left : right;
    }
    return left;
  };
  const parseAnd = (): ExprValue => {
    let left = parseEquality();
    while (isOp('&&')) {
      take();
      const right = parseEquality();
      left = isTruthy(left) ? right : left;
    }
    return left;
  };
  const parseEquality = (): ExprValue => {
    let left = parseUnary();
    while (isOp('==') || isOp('!=')) {
      const negate = take()?.text === '!=';
      const right = parseUnary();
      const equal = comparable(left) === comparable(right);
      left = negate ? !equal : equal;
    }
    return left;
  };
  const parseUnary = (): ExprValue => {
    if (isOp('!')) {
      take();
      return !isTruthy(parseUnary());
    }
    return parsePrimary();
  };
  const parsePrimary = (): ExprValue => {
    const token = take();
    if (token === undefined) throw new UnsupportedExpressionError('unexpected end of expression');
    if (token.kind === 'string') return token.text;
    if (token.kind === 'number') return Number(token.text);
    if (token.kind === 'op' && token.text === '(') {
      const inner = parseOr();
      if (!isOp(')')) throw new UnsupportedExpressionError('missing closing parenthesis');
      take();
      return inner;
    }
    if (token.kind === 'path') {
      if (isOp('(')) {
        take();
        const args: ExprValue[] = [];
        while (!isOp(')')) {
          args.push(parseOr());
          if (isOp(',')) take();
          else if (!isOp(')')) throw new UnsupportedExpressionError('malformed function call');
        }
        take();
        const fn = extra[token.text] ?? FUNCTIONS[token.text];
        if (fn === undefined)
          throw new UnsupportedExpressionError(`unsupported function ${token.text}()`);
        return fn(args);
      }
      if (token.text in LITERALS) return LITERALS[token.text];
      if (token.text.startsWith(SECRETS_PREFIX)) {
        onSecret?.(token.text.slice(SECRETS_PREFIX.length));
        return '';
      }
      const root = token.text.split('.')[0] ?? token.text;
      if (!(root in ctx)) {
        throw new UnsupportedExpressionError(
          `context "${root}" is not available to the predictor (in ${token.text})`,
        );
      }
      return lookup(token.text, ctx);
    }
    throw new UnsupportedExpressionError(`unexpected token ${token.text}`);
  };

  const value = parseOr();
  if (index < tokens.length)
    throw new UnsupportedExpressionError(`unexpected token ${peek()?.text}`);
  return value;
}

export function interpolate(text: string, ctx: ExprContext, onSecret?: SecretReader): string {
  return text.replace(EXPRESSION, (_whole, expression: string) => {
    const value = evaluate(expression, ctx, {}, onSecret);
    return value === undefined || value === null ? '' : String(value);
  });
}

export function conditionHolds(
  condition: string | undefined,
  ctx: ExprContext,
  extra: ExprFunctions = {},
  onSecret?: SecretReader,
): boolean {
  if (condition === undefined) return true;
  const wrapped = WRAPPED.exec(condition);
  return isTruthy(evaluate(wrapped?.[1] ?? condition, ctx, extra, onSecret));
}

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
    throw new UnsupportedExpressionError(
      `${scope}: "${unknown.join('", "')}" is not executed by the predictor; teach it or the drift guard stays blind to it`,
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
  throw new UnsupportedExpressionError(
    `${scope}: continue-on-error must be a literal true or false`,
  );
}

function matrixProjects(id: string, matrix: Record<string, unknown> | undefined): string[] {
  if (matrix === undefined) return [];
  const axes = Object.keys(matrix);
  const projects = matrix[MATRIX_AXIS];
  if (axes.length !== 1 || !Array.isArray(projects)) {
    throw new UnsupportedExpressionError(
      `job ${id}: only a matrix with a single "${MATRIX_AXIS}" list is supported (found ${axes.join(', ')})`,
    );
  }
  return projects.map(String);
}

function topologicalOrder(jobs: Record<string, WorkflowJob>): string[] {
  const levels = new Map<string, number>();
  const levelOf = (id: string, trail: string[]): number => {
    const known = levels.get(id);
    if (known !== undefined) return known;
    if (trail.includes(id)) throw new UnsupportedExpressionError(`job ${id} needs itself`);
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
    jobs[id] = {
      id,
      needs: raw.needs === undefined ? [] : [raw.needs].flat(),
      ...(raw.if === undefined ? {} : { if: String(raw.if) }),
      matrixProjects: matrixProjects(id, raw.strategy?.matrix),
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
