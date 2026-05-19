// __tests__/ask-timeout-behavioral.test.ts
// Behavioral test: verifies that a timeout (or any rejection) from
// anthropic.messages.create() is caught BEFORE the ReadableStream is
// constructed, and that the route still returns HTTP 200 with a
// STREAM_ERR_SENTINEL-prefixed body — not an unhandled 500.
//
// This is a deliberate precedent break from the source-grep-only unit pattern
// (per Copilot review on PR #9). The source-grep version provably misses the
// Finding 1 bug: it only checked that timeout: 30_000 was passed to the
// constructor, not that a pre-stream rejection was caught. This test pairs
// directly with the fix in app/api/ask/route.ts.

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock for messages.create — declared at module scope so tests can
// call mockRejectedValueOnce on it without re-importing the SDK.
const mockMessagesCreate = vi.fn();

// --- Mock @anthropic-ai/sdk before importing the route ---
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate };
  }
  return { default: MockAnthropic };
});

// --- Mock @/lib/rate-limit so we don't need Redis ---
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  checkBudget: vi.fn(async () => ({ allowed: true })),
  incrementBudget: vi.fn(async () => undefined),
}));

// --- Mock PR #11 observability deps so server-only guard doesn't block ---
vi.mock('@/lib/ask-log', () => ({
  persistAskInteraction: vi.fn(async () => undefined),
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: vi.fn(async () => 'hashed-ip-test'),
}));

vi.mock('@/lib/log', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper to read a streamed Response to a string.
async function readBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const dec = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: !done });
  }
  return out;
}

// Helper that builds a minimal POST NextRequest with a JSON body.
function makeRequest(question: string): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/ask behavioral — pre-stream timeout handling', () => {
  beforeEach(() => {
    // Ensure kill switch is off for every test.
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
  });

  it('returns HTTP 200 with STREAM_ERR_SENTINEL body when messages.create rejects', async () => {
    // Arrange: make the SDK reject with a simulated timeout.
    mockMessagesCreate.mockRejectedValueOnce(new Error('Request timed out after 30000ms'));

    // Re-import the route AFTER mocks are in place.
    const { POST } = await import('@/app/api/ask/route');

    const res = await POST(makeRequest('Who is Erik?'));

    // Should be a 200, not a 500.
    expect(res.status).toBe(200);

    // Body should start with the sentinel prefix.
    const body = await readBody(res);
    const { STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');
    expect(body.startsWith(STREAM_ERR_SENTINEL)).toBe(true);
    expect(body).toContain('timed out');
  });
});
