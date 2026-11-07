import { describe, expect, it, vi } from 'vitest';
import {
  createGithubClient,
  parseNextLink,
  parseRemoteUrl,
  resolveRepo,
  resolveToken,
} from '../metrics/github.mjs';

const TOKEN = 'ghs_fixture_token';
const NO_SLEEP = async () => undefined;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function clientWith(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return createGithubClient({ token: TOKEN, fetchImpl, sleep: NO_SLEEP, ...extra });
}

describe('parseNextLink', () => {
  it('returns the rel=next url from a Link header', () => {
    const header =
      '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"';
    expect(parseNextLink(header)).toBe('https://api.github.com/x?page=2');
  });

  it('returns null when there is no next page', () => {
    expect(parseNextLink('<https://api.github.com/x?page=1>; rel="prev"')).toBeNull();
    expect(parseNextLink(null)).toBeNull();
  });
});

describe('createGithubClient', () => {
  it('sends the bearer token to the API host', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    await clientWith(fetchImpl as unknown as typeof fetch).json('/repos/o/r');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('builds the query string from params', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) => jsonResponse([]));
    await clientWith(fetchImpl as unknown as typeof fetch).json('/repos/o/r/deployments', {
      params: { environment: 'Production', per_page: 100 },
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.github.com/repos/o/r/deployments?environment=Production&per_page=100',
    );
  });

  it('follows Link rel=next and concatenates the picked items', async () => {
    const pages = [
      jsonResponse(
        { items: [1, 2] },
        { headers: { link: '<https://api.github.com/p2>; rel="next"' } },
      ),
      jsonResponse({ items: [3] }),
    ];
    const fetchImpl = vi.fn(async (..._args: unknown[]) => pages.shift() as Response);
    const items = await clientWith(fetchImpl as unknown as typeof fetch).paginate('/p1', {
      pick: (body: { items: number[] }) => body.items,
    });
    expect(items).toEqual([1, 2, 3]);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('https://api.github.com/p2');
  });

  it('stops paginating as soon as stopWhen says the page is past the range', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) =>
      jsonResponse([10, 5], { headers: { link: '<https://api.github.com/p2>; rel="next"' } }),
    );
    const items = await clientWith(fetchImpl as unknown as typeof fetch).paginate('/p1', {
      stopWhen: (page: number[]) => page.some((n) => n < 8),
    });
    expect(items).toEqual([10, 5]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a 502 and returns the next good answer', async () => {
    const answers = [new Response('bad gateway', { status: 502 }), jsonResponse({ ok: 1 })];
    const fetchImpl = vi.fn(async () => answers.shift() as Response);
    const body = await clientWith(fetchImpl as unknown as typeof fetch).json('/x');
    expect(body).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('names the reset time when the rate limit is exhausted instead of retrying forever', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('{}', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' },
        }),
    );
    await expect(clientWith(fetchImpl as unknown as typeof fetch).json('/x')).rejects.toThrow(
      /rate limit.*2027-01-15T08:00:00/i,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not replay a POST after a server error, since the first one may have been applied', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad gateway', { status: 502 }));
    await expect(
      clientWith(fetchImpl as unknown as typeof fetch).request('/issues', {
        method: 'POST',
        body: { title: 't' },
      }),
    ).rejects.toThrow(/502/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not replay a POST after a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    await expect(
      clientWith(fetchImpl as unknown as typeof fetch).request('/issues', { method: 'POST' }),
    ).rejects.toThrow(/socket hang up/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('still retries a read-only GraphQL query, which is a POST that changes nothing', async () => {
    const answers = [
      new Response('bad gateway', { status: 502 }),
      jsonResponse({ data: { viewer: 1 } }),
    ];
    const fetchImpl = vi.fn(async () => answers.shift() as Response);
    expect(await clientWith(fetchImpl as unknown as typeof fetch).graphql('query{v}', {})).toEqual({
      viewer: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('waits the retry-after a secondary rate limit asks for, then replays even a POST', async () => {
    const answers = [
      new Response('{}', { status: 403, headers: { 'retry-after': '7' } }),
      jsonResponse({ id: 1 }),
    ];
    const fetchImpl = vi.fn(async () => answers.shift() as Response);
    const sleep = vi.fn(async () => undefined);
    const client = clientWith(fetchImpl as unknown as typeof fetch, { sleep });
    expect(await (await client.request('/issues', { method: 'POST' })).json()).toEqual({ id: 1 });
    expect(sleep).toHaveBeenCalledWith(7000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats a 429 as a secondary rate limit and honours its retry-after', async () => {
    const answers = [
      new Response('{}', { status: 429, headers: { 'retry-after': '2' } }),
      jsonResponse({ ok: 1 }),
    ];
    const fetchImpl = vi.fn(async () => answers.shift() as Response);
    const sleep = vi.fn(async () => undefined);
    await clientWith(fetchImpl as unknown as typeof fetch, { sleep }).json('/x');
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('names the secondary limit instead of sleeping past the bound', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: 403, headers: { 'retry-after': '3600' } }),
    );
    const sleep = vi.fn(async () => undefined);
    await expect(
      clientWith(fetchImpl as unknown as typeof fetch, { sleep }).json('/x'),
    ).rejects.toThrow(/secondary rate limit.*3600/i);
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('names the secondary limit when a 429 carries no retry-after', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 429 }));
    await expect(clientWith(fetchImpl as unknown as typeof fetch).json('/x')).rejects.toThrow(
      /secondary rate limit/i,
    );
  });

  it('leaves a plain 403 as an ordinary HTTP error with its status attached', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 403 }));
    const failure = await clientWith(fetchImpl as unknown as typeof fetch)
      .json('/x')
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/403/);
    expect((failure as Error & { status: number }).status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws a readable error on a 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"message":"Not Found"}', { status: 404 }));
    await expect(clientWith(fetchImpl as unknown as typeof fetch).json('/missing')).rejects.toThrow(
      /\/missing.*404/,
    );
  });

  it('posts graphql and surfaces graphql errors', async () => {
    const ok = vi.fn(async () => jsonResponse({ data: { viewer: 1 } }));
    expect(await clientWith(ok as unknown as typeof fetch).graphql('query{viewer}', {})).toEqual({
      viewer: 1,
    });
    const init = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[0]).toBe('https://api.github.com/graphql');
    expect(init[1].method).toBe('POST');

    const bad = vi.fn(async () => jsonResponse({ errors: [{ message: 'boom' }] }));
    await expect(
      clientWith(bad as unknown as typeof fetch).graphql('query{x}', {}),
    ).rejects.toThrow(/boom/);
  });

  it('fetches a log through the redirect without forwarding the token to the blob host', async () => {
    const calls: { url: string; auth: string | undefined }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization });
      if (url.startsWith('https://api.github.com')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://blob.example/log' },
        });
      }
      return new Response('log body', { status: 200 });
    });
    const text = await clientWith(fetchImpl as unknown as typeof fetch).text('/jobs/1/logs');
    expect(text).toBe('log body');
    expect(calls[0]?.auth).toBe(`Bearer ${TOKEN}`);
    expect(calls[1]).toEqual({ url: 'https://blob.example/log', auth: undefined });
  });
});

describe('resolveToken', () => {
  it('prefers GITHUB_TOKEN, then GH_TOKEN', () => {
    expect(resolveToken({ env: { GITHUB_TOKEN: 'a', GH_TOKEN: 'b' }, execFile: vi.fn() })).toBe(
      'a',
    );
    expect(resolveToken({ env: { GH_TOKEN: 'b' }, execFile: vi.fn() })).toBe('b');
  });

  it('falls back to the gh CLI session', () => {
    const execFile = vi.fn(() => 'gho_cli\n');
    expect(resolveToken({ env: {}, execFile })).toBe('gho_cli');
    expect(execFile).toHaveBeenCalledWith('gh', ['auth', 'token']);
  });

  it('fails with a clear message when nothing yields a token', () => {
    const execFile = vi.fn(() => {
      throw new Error('gh missing');
    });
    expect(() => resolveToken({ env: {}, execFile })).toThrow(/GITHUB_TOKEN/);
  });
});

describe('parseRemoteUrl and resolveRepo', () => {
  it.each([
    ['git@github.com:erikunha/portfolio.git', 'erikunha/portfolio'],
    ['https://github.com/erikunha/portfolio.git', 'erikunha/portfolio'],
    ['https://github.com/erikunha/portfolio', 'erikunha/portfolio'],
    ['ssh://git@github.com/erikunha/portfolio.git', 'erikunha/portfolio'],
  ])('parses %s', (url, expected) => {
    expect(parseRemoteUrl(url)).toBe(expected);
  });

  it('returns null for a non GitHub remote', () => {
    expect(parseRemoteUrl('https://gitlab.com/a/b.git')).toBeNull();
  });

  it('prefers the argument, then GITHUB_REPOSITORY, then the origin remote', () => {
    const execFile = vi.fn(() => 'git@github.com:o/from-remote.git\n');
    expect(resolveRepo({ arg: 'o/arg', env: { GITHUB_REPOSITORY: 'o/env' }, execFile })).toBe(
      'o/arg',
    );
    expect(resolveRepo({ env: { GITHUB_REPOSITORY: 'o/env' }, execFile })).toBe('o/env');
    expect(resolveRepo({ env: {}, execFile })).toBe('o/from-remote');
  });
});
