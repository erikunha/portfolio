import { execFileSync } from 'node:child_process';

const API_BASE = 'https://api.github.com';
const API_HOST = 'api.github.com';
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
export const HTTP_METHOD = Object.freeze({ GET: 'GET', HEAD: 'HEAD', POST: 'POST' });
const REPLAYABLE_METHODS = [HTTP_METHOD.GET, HTTP_METHOD.HEAD];
const ACCEPT_JSON = 'application/vnd.github+json';
const ACCEPT_TEXT = 'text/plain';
const GRAPHQL_PATH = '/graphql';
const REMAINING_EXHAUSTED = '0';
const REMOTE_PATTERN = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/;
const NEXT_LINK = /<([^>]+)>;\s*rel="next"/;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaultExecFile = (file, args) => execFileSync(file, args, { encoding: 'utf8' });

export function parseNextLink(header) {
  if (typeof header !== 'string') return null;
  return NEXT_LINK.exec(header)?.[1] ?? null;
}

function withParams(path, params) {
  const base = path.startsWith('http') ? path : `${API_BASE}${path}`;
  if (params === undefined) return base;
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
  return query === '' ? base : `${base}${base.includes('?') ? '&' : '?'}${query}`;
}

function describeRateLimit(res) {
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const when =
    Number.isFinite(reset) && reset > 0
      ? new Date(reset * MS_PER_SECOND).toISOString()
      : 'an unknown time';
  return `GitHub API rate limit exhausted, resets at ${when}`;
}

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function describeSecondaryLimit(res, retryAfter) {
  const asked = retryAfter === null ? 'no retry-after header' : `retry-after ${retryAfter} seconds`;
  return `GitHub API secondary rate limit hit (HTTP ${res.status}, ${asked}); waiting more than ${MAX_RETRY_AFTER_SECONDS} seconds is not attempted`;
}

function readRetryAfter(res) {
  const raw = res.headers.get('retry-after');
  if (raw === null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function createGithubClient({
  token,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  retries = DEFAULT_RETRIES,
}) {
  const headersFor = (url, accept) => {
    const headers = {
      'User-Agent': USER_AGENT,
      Accept: accept,
      'X-GitHub-Api-Version': API_VERSION,
    };
    if (new URL(url).host === API_HOST) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  async function send(url, init, accept, { replayable }) {
    for (let attempt = 0; ; attempt += 1) {
      let res;
      try {
        res = await fetchImpl(url, {
          ...init,
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
    path,
    { params, method = HTTP_METHOD.GET, body, accept = ACCEPT_JSON, redirect, readOnly } = {},
  ) {
    const url = withParams(path, params);
    const init = { method, ...(redirect === undefined ? {} : { redirect }) };
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

  async function json(path, options) {
    return (await request(path, options)).json();
  }

  async function paginate(path, { params, pick = (page) => page, stopWhen } = {}) {
    const items = [];
    let url = withParams(path, params);
    while (url !== null) {
      const res = await request(url);
      const page = pick(await res.json());
      items.push(...page);
      if (stopWhen?.(page) === true) break;
      url = parseNextLink(res.headers.get('link'));
    }
    return items;
  }

  async function graphql(query, variables) {
    const body = await json(GRAPHQL_PATH, {
      method: HTTP_METHOD.POST,
      body: { query, variables },
      readOnly: true,
    });
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      throw new Error(`GitHub GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
    }
    return body.data;
  }

  async function text(path) {
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

export function resolveToken({ env = process.env, execFile = defaultExecFile } = {}) {
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

export function parseRemoteUrl(url) {
  return REMOTE_PATTERN.exec(String(url).trim())?.[1] ?? null;
}

export function resolveRepo({ arg, env = process.env, execFile = defaultExecFile } = {}) {
  if (arg) return arg;
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  const repo = parseRemoteUrl(execFile('git', ['remote', 'get-url', 'origin']));
  if (repo === null) throw new Error('could not resolve the repository: pass --repo owner/name');
  return repo;
}
