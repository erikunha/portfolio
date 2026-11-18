import { beforeEach, describe, expect, it, vi } from 'vitest';

const postLog = vi.hoisted(() => vi.fn());

vi.mock('@/lib/error-bridge.client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/error-bridge.client')>()),
  postLog,
}));

const PREFIX = '[test]';
const DIGEST = 'abc123';

async function report(digest: unknown) {
  const { reportClientError } = await import('@/lib/report-client-error.client');
  const error = Object.assign(new Error('boom'), { digest });
  reportClientError(PREFIX, error);
  return postLog.mock.calls[0]?.[0] as { digest?: unknown };
}

describe('reportClientError digest', () => {
  beforeEach(() => {
    postLog.mockReset();
  });

  it('sends a string digest', async () => {
    expect((await report(DIGEST)).digest).toBe(DIGEST);
  });

  it('omits a non-string digest', async () => {
    expect((await report({ nested: true })).digest).toBeUndefined();
  });

  it('omits a numeric digest', async () => {
    expect((await report(42)).digest).toBeUndefined();
  });
});
