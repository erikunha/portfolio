// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const limiter = vi.hoisted(() => ({
  limit: vi.fn(),
  constructed: [] as Array<{ prefix?: string }>,
}));

vi.mock('@upstash/ratelimit', () => {
  function Ratelimit(this: object, opts: { prefix?: string }) {
    limiter.constructed.push(opts);
    Object.assign(this, { limit: limiter.limit });
  }
  Ratelimit.slidingWindow = vi.fn(() => ({}));
  Ratelimit.fixedWindow = vi.fn(() => ({}));
  return { Ratelimit };
});
vi.mock('@/lib/log', async () => (await import('./helpers/modules')).logModule());

import { POST } from '@/app/api/csp-report/route';
import { log } from '@/lib/log';

const SINK_URL = 'https://www.erikunha.dev/api/csp-report';
const VIOLATION_MESSAGE = 'csp violation';
const MAX_BODY_BYTES = 4096;
const LEGACY_TYPE = 'application/csp-report';
const REPORTING_API_TYPE = 'application/reports+json';

const legacyReport = (overrides: Record<string, string> = {}) => ({
  'csp-report': {
    'document-uri': 'https://www.erikunha.dev/pt/cv?session=secret-doc-query',
    'effective-directive': 'script-src-elem',
    'violated-directive': 'script-src-elem',
    'blocked-uri': 'https://evil.example/payload/x.js?token=secret-blocked-query',
    disposition: 'enforce',
    ...overrides,
  },
});

const reportingApiEntry = (body: Record<string, string> = {}, type = 'csp-violation') => ({
  type,
  age: 10,
  url: 'https://www.erikunha.dev/pt/cv',
  body: {
    documentURL: 'https://www.erikunha.dev/pt/cv?session=secret-doc-query',
    effectiveDirective: 'img-src',
    blockedURL: 'https://cdn.example/a/b.png?token=secret-blocked-query',
    disposition: 'report',
    ...body,
  },
});

function send(body: string, contentType: string | null = LEGACY_TYPE): Promise<Response> {
  return POST(
    new Request(SINK_URL, {
      method: 'POST',
      headers: {
        ...(contentType === null ? {} : { 'Content-Type': contentType }),
        'x-forwarded-for': '203.0.113.9',
      },
      body,
    }),
  );
}

const sendLegacy = (overrides: Record<string, string> = {}) =>
  send(JSON.stringify(legacyReport(overrides)));

const violations = () =>
  vi.mocked(log.warn).mock.calls.filter(([message]) => message === VIOLATION_MESSAGE);

describe('POST /api/csp-report', () => {
  beforeEach(() => {
    vi.mocked(log.warn).mockClear();
    limiter.limit.mockReset();
    limiter.limit.mockResolvedValue({ success: true });
  });

  describe('accepted reports', () => {
    it('logs one legacy report with the directive, blocked host, document path and disposition', async () => {
      const res = await sendLegacy();

      expect(res.status).toBe(204);
      expect(await res.text()).toBe('');
      expect(violations()).toEqual([
        [
          VIOLATION_MESSAGE,
          {
            effectiveDirective: 'script-src-elem',
            blockedHost: 'evil.example',
            documentPath: '/pt/cv',
            disposition: 'enforce',
          },
        ],
      ]);
    });

    it('never logs the full URL, a query string or a blocked path', async () => {
      await sendLegacy();

      expect(violations()).toHaveLength(1);
      const logged = JSON.stringify(vi.mocked(log.warn).mock.calls);
      expect(logged).not.toContain('secret-blocked-query');
      expect(logged).not.toContain('secret-doc-query');
      expect(logged).not.toContain('payload');
      expect(logged).not.toContain('https://');
    });

    it('logs every csp-violation of a Reporting API batch and skips other report types', async () => {
      const batch = [
        reportingApiEntry(),
        reportingApiEntry({
          effectiveDirective: 'connect-src',
          blockedURL: 'https://api.example/x',
        }),
        reportingApiEntry({}, 'deprecation'),
      ];

      const res = await send(JSON.stringify(batch), REPORTING_API_TYPE);

      expect(res.status).toBe(204);
      expect(violations().map(([, ctx]) => ctx)).toEqual([
        {
          effectiveDirective: 'img-src',
          blockedHost: 'cdn.example',
          documentPath: '/pt/cv',
          disposition: 'report',
        },
        {
          effectiveDirective: 'connect-src',
          blockedHost: 'api.example',
          documentPath: '/pt/cv',
          disposition: 'report',
        },
      ]);
    });

    it('accepts a content type with parameters and any letter case', async () => {
      const res = await send(
        JSON.stringify(legacyReport()),
        'Application/CSP-Report; charset=utf-8',
      );

      expect(res.status).toBe(204);
      expect(violations()).toHaveLength(1);
    });

    it.each([
      ['inline', 'inline'],
      ['eval', 'eval'],
      ['data:text/html;base64,PHNjcmlwdD4=', 'data'],
    ])('logs a %s blocked source as %s', async (blocked, expected) => {
      await sendLegacy({ 'blocked-uri': blocked });

      expect(violations()[0]?.[1]).toMatchObject({ blockedHost: expected });
    });

    it('logs a bounded placeholder instead of an unparseable blocked source', async () => {
      await sendLegacy({ 'blocked-uri': 'not a url, with spaces and ?query=secret-blocked-query' });

      const [[, ctx]] = violations() as [[string, { blockedHost: string }]];
      expect(ctx.blockedHost).toBe('unknown');
      expect(JSON.stringify(ctx)).not.toContain('secret-blocked-query');
    });

    it('falls back to the violated directive when the effective one is absent', async () => {
      const { 'csp-report': report } = legacyReport();
      const { 'effective-directive': _dropped, ...withoutEffective } = report;

      await send(JSON.stringify({ 'csp-report': withoutEffective }));

      expect(violations()[0]?.[1]).toMatchObject({ effectiveDirective: 'script-src-elem' });
    });

    it('logs "unknown" for a disposition other than enforce or report', async () => {
      await sendLegacy({ disposition: 'sideways' });

      expect(violations()[0]?.[1]).toMatchObject({ disposition: 'unknown' });
    });

    it('still logs a report whose blocked source is not a string', async () => {
      const { 'csp-report': report } = legacyReport();

      await send(JSON.stringify({ 'csp-report': { ...report, 'blocked-uri': 7 } }));

      expect(violations()[0]?.[1]).toMatchObject({ blockedHost: 'unknown' });
    });

    it('logs "unknown" for a directive that is not a directive name', async () => {
      await sendLegacy({ 'effective-directive': 'script-src\nforged log line' });

      expect(violations()[0]?.[1]).toMatchObject({ effectiveDirective: 'unknown' });
    });
  });

  describe('browser extension noise', () => {
    it.each([
      'chrome-extension://abcdefghijklmnop/content.js',
      'moz-extension://11111111-2222-3333-4444-555555555555/inject.js',
      'safari-web-extension://AAAA-BBBB/script.js',
      'ms-browser-extension://abcdef/x.js',
    ])('drops a report blocked at %s with 204 and no log', async (blocked) => {
      const res = await sendLegacy({ 'blocked-uri': blocked });

      expect(res.status).toBe(204);
      expect(violations()).toEqual([]);
    });

    it('drops a report whose source file is an extension', async () => {
      const res = await sendLegacy({ 'source-file': 'chrome-extension://abcdefghijklmnop/x.js' });

      expect(res.status).toBe(204);
      expect(violations()).toEqual([]);
    });

    it('drops an extension report inside a Reporting API batch and keeps its neighbours', async () => {
      const batch = [
        reportingApiEntry({ blockedURL: 'moz-extension://id/inject.js' }),
        reportingApiEntry({ sourceFile: 'chrome-extension://id/x.js' }),
        reportingApiEntry(),
      ];

      await send(JSON.stringify(batch), REPORTING_API_TYPE);

      expect(violations()).toHaveLength(1);
      expect(violations()[0]?.[1]).toMatchObject({ blockedHost: 'cdn.example' });
    });

    it('keeps a web source that only has "extension" in its host', async () => {
      await sendLegacy({ 'blocked-uri': 'https://extension.example/lib.js' });

      expect(violations()[0]?.[1]).toMatchObject({ blockedHost: 'extension.example' });
    });
  });

  describe('request validation', () => {
    it.each([['application/json'], ['text/plain'], [null]])(
      'rejects content type %s with 400 and logs nothing',
      async (contentType) => {
        const res = await send(JSON.stringify(legacyReport()), contentType);

        expect(res.status).toBe(400);
        expect(violations()).toEqual([]);
      },
    );

    it('rejects a body that is not JSON with 400', async () => {
      const res = await send('{"csp-report":', LEGACY_TYPE);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ ok: false, error: { code: 'invalid_json' } });
      expect(violations()).toEqual([]);
    });

    it.each([
      ['an empty object', {}],
      ['a report without fields', { 'csp-report': {} }],
      ['a scalar', 7],
    ])('answers 204 and logs nothing for %s', async (_name, payload) => {
      const res = await send(JSON.stringify(payload));

      expect(res.status).toBe(204);
      expect(violations()).toEqual([]);
    });
  });

  describe('4 KB body bound', () => {
    const bodyOfBytes = (bytes: number): string => {
      const base = JSON.stringify(legacyReport({ 'original-policy': '' })).length;
      return JSON.stringify(legacyReport({ 'original-policy': 'p'.repeat(bytes - base) }));
    };

    it('accepts a body of exactly 4096 bytes', async () => {
      const body = bodyOfBytes(MAX_BODY_BYTES);
      expect(new TextEncoder().encode(body).byteLength).toBe(MAX_BODY_BYTES);

      const res = await send(body);

      expect(res.status).toBe(204);
      expect(violations()).toHaveLength(1);
    });

    it('rejects a body of 4097 bytes with 413 and logs nothing', async () => {
      const res = await send(bodyOfBytes(MAX_BODY_BYTES + 1));

      expect(res.status).toBe(413);
      expect(await res.json()).toMatchObject({ ok: false, error: { code: 'payload_too_large' } });
      expect(violations()).toEqual([]);
    });
  });

  describe('rate limit', () => {
    it('answers 429 with Retry-After before reading the body', async () => {
      limiter.limit.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });

      const res = await send('x'.repeat(MAX_BODY_BYTES * 2), 'text/plain');

      expect(res.status).toBe(429);
      expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
      expect(violations()).toEqual([]);
    });

    it('limits on the hashed client key, never the raw address', async () => {
      await sendLegacy();

      expect(limiter.limit).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{16}$/));
      expect(limiter.limit).not.toHaveBeenCalledWith('203.0.113.9');
    });

    it('keeps logging reports when the limiter is unreachable', async () => {
      limiter.limit.mockRejectedValue(new Error('redis down'));

      const res = await sendLegacy();

      expect(res.status).toBe(204);
      expect(violations()).toHaveLength(1);
    });

    it('gives the sink its own key prefix, distinct from every other limiter', async () => {
      vi.resetModules();
      limiter.constructed.length = 0;
      const fresh = await import('@/lib/rate-limit');
      const getters = Object.entries(fresh).filter(([name]) => /^get\w+Limit$/.test(name));
      expect(getters.map(([name]) => name)).toContain('getCspReportLimit');
      for (const [, getter] of getters) (getter as () => unknown)();

      const prefixes = limiter.constructed.map(({ prefix }) => prefix);
      expect(prefixes).toHaveLength(getters.length);
      expect(new Set(prefixes).size).toBe(prefixes.length);
    });
  });
});
