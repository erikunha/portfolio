import { REDIS_ENV_PAIRS } from '@/lib/rate-limit';

export const EVAL_PUBLISH_ENV = 'EVAL_PUBLISH';
export const EVAL_PUBLISH_VALUE = '1';

export type RedisCredentials = Readonly<Record<string, string>>;

type Env = Record<string, string | undefined>;

export function isPublishEnabled(env: Env): boolean {
  return env[EVAL_PUBLISH_ENV] === EVAL_PUBLISH_VALUE;
}

export function isolateFromRedis(env: Env): RedisCredentials {
  const publishing = isPublishEnabled(env);
  const withheld: Record<string, string> = {};
  for (const { url, token } of REDIS_ENV_PAIRS) {
    for (const name of [url, token]) {
      const value = env[name];
      if (publishing && value) withheld[name] = value;
      delete env[name];
    }
  }
  return withheld;
}

export function restoreRedisCredentials(env: Env, credentials: RedisCredentials): void {
  Object.assign(env, credentials);
}

export function dropRedisCredentials(env: Env, credentials: RedisCredentials): void {
  for (const name of Object.keys(credentials)) delete env[name];
}

const PUBLISH_URL_PROTOCOLS = new Set(['https:', 'http:']);
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const URL_SECRET_HINT = 'In GitHub Actions it comes from the EVAL_PUBLISH_REDIS_REST_URL secret.';

function completePairs(credentials: RedisCredentials) {
  return REDIS_ENV_PAIRS.filter(({ url, token }) =>
    Boolean(credentials[url] && credentials[token]),
  );
}

function redisUrlProblem(value: string): string | null {
  if (!URL_SCHEME.test(value)) {
    return /^["']|["']$/.test(value) ? 'is wrapped in quotes' : 'has no http(s) scheme';
  }
  try {
    return PUBLISH_URL_PROTOCOLS.has(new URL(value).protocol)
      ? null
      : 'does not use the http(s) REST endpoint';
  } catch {
    return 'cannot be parsed as a URL';
  }
}

export function publishPreflightError(env: Env, credentials: RedisCredentials): string | null {
  if (!isPublishEnabled(env)) return null;
  const pairs = completePairs(credentials);
  if (pairs.length > 0) {
    const problems = pairs.map(({ url }) => ({
      url,
      problem: redisUrlProblem(credentials[url] ?? ''),
    }));
    if (problems.some(({ problem }) => problem === null)) return null;
    const detail = problems.map(({ url, problem }) => `${url} ${problem}`).join(' and ');
    return `${EVAL_PUBLISH_ENV}=${EVAL_PUBLISH_VALUE} needs a Redis REST URL the run can reach, but ${detail} (the value is not printed). ${URL_SECRET_HINT}`;
  }
  const names = REDIS_ENV_PAIRS.map(({ url, token }) => `${url} and ${token}`).join(' or ');
  return `${EVAL_PUBLISH_ENV}=${EVAL_PUBLISH_VALUE} needs Redis credentials, but ${names} is not set or is empty. In GitHub Actions they come from the EVAL_PUBLISH_REDIS_REST_URL and EVAL_PUBLISH_REDIS_REST_TOKEN secrets.`;
}

export function publishOutcomeError(result: { published: boolean; error?: string }): string | null {
  if (result.published || result.error === undefined) return null;
  return `${EVAL_PUBLISH_ENV}=${EVAL_PUBLISH_VALUE} but the aggregate was not published: ${result.error}`;
}
