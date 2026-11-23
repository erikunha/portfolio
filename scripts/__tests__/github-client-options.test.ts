import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubReader } from '../ci/wait-argos-reference.ts';
import { PINS } from '../gates/check-tool-pins.ts';
import { createGithubClient } from '../lib/github-client.ts';

const TOKEN = 'ghs_scoped_fixture_token';
const GITHUB_URL = 'https://api.github.com/repos/o/r';
const OTHER_URL = 'https://pypi.org/pypi/semgrep/json';
const OTHER_HOST_NEXT = 'https://evil.example.test/page2';
const INTERNAL_URL = 'https://ghe.example.test/api/v3/repos/o/r';
const NO_SLEEP = async () => undefined;
const SERVER_ERROR = 500;
const DEFAULT_ATTEMPTS = 3;
const TIMEOUT_MS = 5_000;
const CUSTOM_AGENT = 'custom-agent';
const SHA = 'a'.repeat(40);

type Call = { url: string; init: RequestInit };

const authorizationOf = (call: Call | undefined): string | undefined =>
  (call?.init.headers as Record<string, string> | undefined)?.Authorization;

function recordingFetch(respond: (url: string) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    calls.push({ url: href, init: init ?? {} });
    return respond(href);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const ok = (body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('token scoping', () => {
  it('sends the token to api.github.com and to no other host', async () => {
    const { calls, fetchImpl } = recordingFetch(() => ok());
    const client = createGithubClient({ token: TOKEN, fetchImpl, sleep: NO_SLEEP });
    await client.json(GITHUB_URL);
    await client.json(OTHER_URL);
    expect(authorizationOf(calls[0])).toBe(`Bearer ${TOKEN}`);
    expect(
      authorizationOf(calls[1]),
      'a token that reaches another host is leaked to a third party',
    ).toBeUndefined();
  });

  it('does not follow a next link to another host with the token', async () => {
    const { calls, fetchImpl } = recordingFetch((url) =>
      url === `${GITHUB_URL}/items`
        ? ok([1], { link: `<${OTHER_HOST_NEXT}>; rel="next"` })
        : ok([2]),
    );
    const client = createGithubClient({ token: TOKEN, fetchImpl, sleep: NO_SLEEP });
    await client.paginate(`${GITHUB_URL}/items`);
    expect(calls.map((call) => call.url)).toEqual([`${GITHUB_URL}/items`, OTHER_HOST_NEXT]);
    expect(authorizationOf(calls[0])).toBe(`Bearer ${TOKEN}`);
    expect(authorizationOf(calls[1])).toBeUndefined();
  });

  it('sends the token only to the hosts named in tokenHosts', async () => {
    const { calls, fetchImpl } = recordingFetch(() => ok());
    const client = createGithubClient({
      token: TOKEN,
      tokenHosts: ['ghe.example.test'],
      fetchImpl,
      sleep: NO_SLEEP,
    });
    await client.json(INTERNAL_URL);
    await client.json(GITHUB_URL);
    expect(authorizationOf(calls[0])).toBe(`Bearer ${TOKEN}`);
    expect(authorizationOf(calls[1])).toBeUndefined();
  });

  it.each([undefined, ''])(
    'sends no Authorization on any host when the token is %j',
    async (token) => {
      const { calls, fetchImpl } = recordingFetch(() => ok());
      const client = createGithubClient({ token, fetchImpl, sleep: NO_SLEEP });
      await client.json(GITHUB_URL);
      await client.json(OTHER_URL);
      expect(calls.map(authorizationOf)).toEqual([undefined, undefined]);
    },
  );

  it('keeps the GitHub API version header off other hosts', async () => {
    const { calls, fetchImpl } = recordingFetch(() => ok());
    const client = createGithubClient({ token: TOKEN, fetchImpl, sleep: NO_SLEEP });
    await client.json(GITHUB_URL);
    await client.json(OTHER_URL);
    const versionOf = (call: Call | undefined) =>
      (call?.init.headers as Record<string, string> | undefined)?.['X-GitHub-Api-Version'];
    expect(versionOf(calls[0])).toBeTruthy();
    expect(versionOf(calls[1])).toBeUndefined();
  });
});

describe('client options', () => {
  it('sends the user agent it was given', async () => {
    const { calls, fetchImpl } = recordingFetch(() => ok());
    await createGithubClient({ token: TOKEN, userAgent: CUSTOM_AGENT, fetchImpl }).json(GITHUB_URL);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(CUSTOM_AGENT);
  });

  it('retries a server error up to the retries option, and not at all with zero', async () => {
    const failing = recordingFetch(() => new Response('x', { status: SERVER_ERROR }));
    await expect(
      createGithubClient({ token: TOKEN, fetchImpl: failing.fetchImpl, sleep: NO_SLEEP }).json(
        GITHUB_URL,
      ),
    ).rejects.toThrow(String(SERVER_ERROR));
    expect(failing.calls).toHaveLength(DEFAULT_ATTEMPTS);

    const once = recordingFetch(() => new Response('x', { status: SERVER_ERROR }));
    await expect(
      createGithubClient({
        token: TOKEN,
        retries: 0,
        fetchImpl: once.fetchImpl,
        sleep: NO_SLEEP,
      }).json(GITHUB_URL),
    ).rejects.toThrow(String(SERVER_ERROR));
    expect(once.calls).toHaveLength(1);
  });

  it('aborts a request after timeoutMs, and sets no signal without it', async () => {
    const withTimeout = recordingFetch(() => ok());
    await createGithubClient({
      token: TOKEN,
      timeoutMs: TIMEOUT_MS,
      fetchImpl: withTimeout.fetchImpl,
    }).json(GITHUB_URL);
    expect(withTimeout.calls[0]?.init.signal).toBeInstanceOf(AbortSignal);

    const without = recordingFetch(() => ok());
    await createGithubClient({ token: TOKEN, fetchImpl: without.fetchImpl }).json(GITHUB_URL);
    expect(without.calls[0]?.init.signal).toBeUndefined();
  });
});

describe('the callers share the client', () => {
  it('wait-argos-reference sends its token to api.github.com only and never retries', async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response('x', { status: SERVER_ERROR });
      }),
    );
    const read = githubReader({ repository: 'o/r', token: TOKEN, baseRef: 'main', headSha: SHA });
    await expect(read()).rejects.toThrow(String(SERVER_ERROR));
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]?.url ?? '').host).toBe('api.github.com');
    expect(authorizationOf(calls[0])).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('check-tool-pins sends GITHUB_TOKEN to GitHub and never to PyPI', async () => {
    vi.stubEnv('GITHUB_TOKEN', TOKEN);
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return url.includes('pypi.org')
          ? ok({ info: { version: '1.0.0' } })
          : ok({ tag_name: 'v1.0.0' });
      }),
    );
    for (const pin of PINS) await pin.latest();
    const pypi = calls.find((call) => new URL(call.url).host === 'pypi.org');
    const github = calls.find((call) => new URL(call.url).host === 'api.github.com');
    expect(pypi).toBeDefined();
    expect(github).toBeDefined();
    expect(authorizationOf(pypi)).toBeUndefined();
    expect(authorizationOf(github)).toBe(`Bearer ${TOKEN}`);
  });
});
