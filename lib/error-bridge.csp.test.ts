import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_REPORTS_PER_SESSION } from '@/lib/error-bridge.client';

const BRIDGE_STATE_KEY = Symbol.for('erikunha.dev/error-bridge');
const HTTP_NO_CONTENT = 204;
const SETTLE_MS = 20;
const DEDUP_WINDOW_MS = 150;
const BURST_SIZE = 25;

type Posted = { level: string; message: string; url?: string; stack?: string };
type BridgeState = { failures: number; blockedUntil: number; reported: number };

const posts: Posted[] = [];
const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
  posts.push(JSON.parse(String(init.body)) as Posted);
  return new Response(null, { status: HTTP_NO_CONTENT });
});

type ViolationInit = {
  effectiveDirective?: string;
  blockedURI?: string;
  sourceFile?: string;
  documentURI?: string;
  disposition?: string;
};

function bridgeState(): BridgeState | undefined {
  return (window as unknown as Record<symbol, BridgeState | undefined>)[BRIDGE_STATE_KEY];
}

function fireViolation(init: ViolationInit): void {
  document.dispatchEvent(
    Object.assign(new Event('securitypolicyviolation'), {
      effectiveDirective: 'script-src-elem',
      blockedURI: 'https://cdn.example.net/path/lib.js?token=secret',
      sourceFile: '',
      documentURI: `${window.location.origin}/cv?private=1#frag`,
      disposition: 'enforce',
      ...init,
    }),
  );
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

describe('error bridge CSP violation reporting', () => {
  beforeEach(() => {
    const state = bridgeState();
    if (state) Object.assign(state, { failures: 0, blockedUntil: 0, reported: 0 });
    posts.length = 0;
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockClear();
  });

  it('reports one violation with the directive, the blocked host and the document path only', async () => {
    fireViolation({});
    await vi.waitFor(() => expect(posts).toHaveLength(1));

    const post = posts[0] as Posted;
    expect(post.level).toBe('warn');
    expect(post.message).toContain('script-src-elem');
    expect(post.message).toContain('cdn.example.net');
    expect(post.message).toContain('enforce');
    expect(post.message).toContain('/cv');
    const wire = JSON.stringify(post);
    expect(wire).not.toContain('token=secret');
    expect(wire).not.toContain('/path/lib.js');
    expect(wire).not.toContain('private=1');
    expect(wire).not.toContain('#frag');
  });

  it('keeps the keyword of a non-URL blocked source and falls back to unknown otherwise', async () => {
    fireViolation({ blockedURI: 'inline' });
    fireViolation({ blockedURI: 'not a url !!', effectiveDirective: 'img-src' });
    await vi.waitFor(() => expect(posts).toHaveLength(2));

    expect(posts[0]?.message).toContain('inline');
    expect(posts[1]?.message).toContain('unknown');
    expect(posts[1]?.message).not.toContain('not a url');
  });

  it.each([
    ['blocked source', { blockedURI: 'chrome-extension://abcdef/inject.js' }],
    [
      'source file',
      {
        blockedURI: 'https://ext-a.example.net/a.js',
        sourceFile: 'moz-extension://abcdef/content.js',
      },
    ],
    [
      'safari source file',
      {
        blockedURI: 'https://ext-b.example.net/a.js',
        sourceFile: 'safari-web-extension://abcdef/x.js',
      },
    ],
  ])('drops a violation from a browser extension %s', async (_name, init) => {
    fireViolation(init);
    await settle();

    expect(posts).toHaveLength(0);
  });

  it('collapses identical violations fired in a burst into one report', async () => {
    for (let i = 0; i < BURST_SIZE; i += 1) {
      fireViolation({ blockedURI: 'https://burst.example.net/a.js' });
    }
    await settle();

    expect(posts).toHaveLength(1);
  });

  it('reports the same violation again once the dedupe window has passed', async () => {
    fireViolation({ blockedURI: 'https://again.example.net/a.js' });
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, DEDUP_WINDOW_MS));
    fireViolation({ blockedURI: 'https://again.example.net/a.js' });

    await vi.waitFor(() => expect(posts).toHaveLength(2));
  });

  it('stops reporting once the session report cap is reached', async () => {
    const state = bridgeState();
    if (state) state.reported = MAX_REPORTS_PER_SESSION;
    fireViolation({ blockedURI: 'https://capped.example.net/a.js' });
    await settle();

    expect(posts).toHaveLength(0);
  });
});
