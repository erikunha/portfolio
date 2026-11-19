import { execFileSync } from 'node:child_process';

const API_BASE = 'https://api.github.com';
const API_HOST = 'api.github.com';
const DEFAULT_TOKEN_HOSTS: readonly string[] = [API_HOST];
const USER_AGENT = 'erikunha-portfolio-weekly-metrics';
const API_VERSION = '2022-11-28';
const DEFAULT_RETRIES = 2;
const RETRY_BASE_MS = 1000;
const SERVER_ERROR_FLOOR = 500;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_REQUESTS_STATUS = 429;
const RATE_LIMIT_STATUSES = [FORBIDDEN_STATUS, TOO_MANY_REQUESTS_STATUS];
const MAX_RETRY_AFTER_SECONDS = 60;
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
const MS_PER_SECOND = 1000;
export const HTTP_METHOD = Object.freeze({ GET: 'GET', HEAD: 'HEAD', POST: 'POST' } as const);
const REPLAYABLE_METHODS: readonly string[] = [HTTP_METHOD.GET, HTTP_METHOD.HEAD];
const ACCEPT_JSON = 'application/vnd.github+json';
const ACCEPT_TEXT = 'text/plain';
const GRAPHQL_PATH = '/graphql';
const REMAINING_EXHAUSTED = '0';
const REMOTE_PATTERN = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/;
const NEXT_LINK = /<([^>]+)>;\s*rel="next"/;

export interface HttpError extends Error {
  status?: number;
}

export interface RequestOptions {
  params?: Record<string, string | number>;
  method?: string;
  body?: unknown;
  accept?: string;
  redirect?: 'manual' | 'follow';
  readOnly?: boolean;
}

export interface PaginateOptions<T> {
  params?: Record<string, string | number>;
  pick?: (body: never) => T[];
  stopWhen?: (page: T[]) => boolean;
}

export interface GithubClient {
  request(path: string, options?: RequestOptions): Promise<Response>;
  json<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  paginate<T = unknown>(path: string, options?: PaginateOptions<T>): Promise<T[]>;
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
  text(path: string): Promise<string>;
}

export interface GithubClientOptions {
  token?: string | undefined;
  tokenHosts?: readonly string[];
  userAgent?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retries?: number;
}

export interface HeaderOptions {
  url: string;
  token: string | undefined;
  accept: string;
  userAgent?: string;
  tokenHosts?: readonly string[];
}

type ExecFile = (file: string, args: string[]) => string;
type Env = Record<string, string | undefined>;

interface SendInit {
  method: string;
  redirect?: 'manual' | 'follow';
  body?: string;
  headers?: Record<string, string>;
}

interface GraphqlBody<T> {
  data: T;
  errors?: { message: string }[];
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
const defaultExecFile: ExecFile = (file, args) => execFileSync(file, args, { encoding: 'utf8' });

export function parseNextLink(header: string | null | undefined): string | null {
  if (typeof header !== 'string') return null;
  return NEXT_LINK.exec(header)?.[1] ?? null;
}

function withParams(path: string, params: Record<string, string | number> | undefined): string {
  const base = path.startsWith('http') ? path : `${API_BASE}${path}`;
  if (params === undefined) return base;
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]): [string, string] => [key, String(value)]),
  ).toString();
  return query === '' ? base : `${base}${base.includes('?') ? '&' : '?'}${query}`;
}

function describeRateLimit(res: Response): string {
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const when =
    Number.isFinite(reset) && reset > 0
      ? new Date(reset * MS_PER_SECOND).toISOString()
      : 'an unknown time';
  return `GitHub API rate limit exhausted, resets at ${when}`;
}

function httpError(message: string, status: number): HttpError {
  return Object.assign(new Error(message), { status });
}

function describeSecondaryLimit(res: Response, retryAfter: number | null): string {
  const asked = retryAfter === null ? 'no retry-after header' : `retry-after ${retryAfter} seconds`;
  return `GitHub API secondary rate limit hit (HTTP ${res.status}, ${asked}); waiting more than ${MAX_RETRY_AFTER_SECONDS} seconds is not attempted`;
}

function readRetryAfter(res: Response): number | null {
  const raw = res.headers.get('retry-after');
  if (raw === null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function buildHeaders({
  url,
  token,
  accept,
  userAgent = USER_AGENT,
  tokenHosts = DEFAULT_TOKEN_HOSTS,
}: HeaderOptions): Record<string, string> {
  const { host } = new URL(url);
  const headers: Record<string, string> = { 'User-Agent': userAgent, Accept: accept };
  if (host === API_HOST) headers['X-GitHub-Api-Version'] = API_VERSION;
  if (token !== undefined && token !== '' && tokenHosts.includes(host)) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function createGithubClient({
  token,
  tokenHosts = DEFAULT_TOKEN_HOSTS,
  userAgent = USER_AGENT,
  timeoutMs,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  retries = DEFAULT_RETRIES,
}: GithubClientOptions = {}): GithubClient {
  const headersFor = (url: string, accept: string): Record<string, string> =>
    buildHeaders({ url, token, accept, userAgent, tokenHosts });

  async function send(
    url: string,
    init: SendInit,
    accept: string,
    { replayable }: { replayable: boolean },
  ): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      let res: Response;
      try {
        res = await fetchImpl(url, {
          ...init,
          ...(timeoutMs === undefined ? {} : { signal: AbortSignal.timeout(timeoutMs) }),
          headers: { ...headersFor(url, accept), ...init.headers },
        });
      } catch (error) {
        if (!replayable || attempt >= retries) throw error;
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      const limited = RATE_LIMIT_STATUSES.includes(res.status);
      if (limited && res.headers.get('x-ratelimit-remaining') === REMAINING_EXHAUSTED) {
        throw httpError(describeRateLimit(res), res.status);
      }
      const retryAfter = readRetryAfter(res);
      const secondary =
        res.status === TOO_MANY_REQUESTS_STATUS ||
        (res.status === FORBIDDEN_STATUS && retryAfter !== null);
      if (secondary) {
        if (retryAfter === null || retryAfter > MAX_RETRY_AFTER_SECONDS || attempt >= retries) {
          throw httpError(describeSecondaryLimit(res, retryAfter), res.status);
        }
        await sleep(retryAfter * MS_PER_SECOND);
        continue;
      }
      if (res.status >= SERVER_ERROR_FLOOR && replayable && attempt < retries) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      return res;
    }
  }

  async function request(
    path: string,
    {
      params,
      method = HTTP_METHOD.GET,
      body,
      accept = ACCEPT_JSON,
      redirect,
      readOnly,
    }: RequestOptions = {},
  ): Promise<Response> {
    const url = withParams(path, params);
    const init: SendInit = { method, ...(redirect === undefined ? {} : { redirect }) };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { 'Content-Type': 'application/json' };
    }
    const replayable = readOnly ?? REPLAYABLE_METHODS.includes(method);
    const res = await send(url, init, accept, { replayable });
    const redirected = redirect === 'manual' && REDIRECT_STATUSES.includes(res.status);
    if (!res.ok && !redirected) {
      throw httpError(`GitHub API ${method} ${path} returned HTTP ${res.status}`, res.status);
    }
    return res;
  }

  async function json<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return (await request(path, options)).json();
  }

  async function paginate<T = unknown>(
    path: string,
    { params, pick, stopWhen }: PaginateOptions<T> = {},
  ): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = withParams(path, params);
    while (url !== null) {
      const res: Response = await request(url);
      const body: unknown = await res.json();
      const page = pick === undefined ? (body as T[]) : pick(body as never);
      items.push(...page);
      if (stopWhen?.(page) === true) break;
      url = parseNextLink(res.headers.get('link'));
    }
    return items;
  }

  async function graphql<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const body = await json<GraphqlBody<T>>(GRAPHQL_PATH, {
      method: HTTP_METHOD.POST,
      body: { query, variables },
      readOnly: true,
    });
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      throw new Error(`GitHub GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
    }
    return body.data;
  }

  async function text(path: string): Promise<string> {
    const first = await request(path, {
      redirect: 'manual',
      accept: ACCEPT_JSON,
    });
    const location = first.headers.get('location');
    if (!REDIRECT_STATUSES.includes(first.status) || location === null) return first.text();
    const res = await send(location, { method: HTTP_METHOD.GET }, ACCEPT_TEXT, {
      replayable: true,
    });
    if (!res.ok) throw httpError(`log download returned HTTP ${res.status}`, res.status);
    return res.text();
  }

  return { request, json, paginate, graphql, text };
}

export function resolveToken({
  env = process.env,
  execFile = defaultExecFile,
}: {
  env?: Env;
  execFile?: ExecFile;
} = {}): string {
  const fromEnv = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const fromCli = String(execFile('gh', ['auth', 'token'])).trim();
    if (fromCli !== '') return fromCli;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
  throw new Error('no GitHub token: set GITHUB_TOKEN or sign in with `gh auth login`');
}

export function parseRemoteUrl(url: string): string | null {
  return REMOTE_PATTERN.exec(String(url).trim())?.[1] ?? null;
}

export function resolveRepo({
  arg,
  env = process.env,
  execFile = defaultExecFile,
}: {
  arg?: string | undefined;
  env?: Env;
  execFile?: ExecFile;
} = {}): string {
  if (arg) return arg;
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  const repo = parseRemoteUrl(execFile('git', ['remote', 'get-url', 'origin']));
  if (repo === null) throw new Error('could not resolve the repository: pass --repo owner/name');
  return repo;
}
