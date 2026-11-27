import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_RECOVERY_STORAGE_KEY } from '@/lib/chunk-load-recovery.client';
import { useErrorReport } from './ErrorPages.client';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const CHUNK_MESSAGE =
  'Failed to load chunk /_next/static/immutable/chunks/3pjezcwcinob5.js from module 44391';
const HTTP_NO_CONTENT = 204;
const ROUTE_PREFIX = '[RouteError]';

function chunkError(): Error {
  const error = new Error(CHUNK_MESSAGE);
  error.name = 'ChunkLoadError';
  return error;
}

function Reporter({ error }: { error: Error }) {
  useErrorReport(ROUTE_PREFIX, error);
  return null;
}

describe('route and global error pages recover from a chunk load error', () => {
  const reload = vi.fn();
  const fetchSpy = vi.fn(async () => new Response(null, { status: HTTP_NO_CONTENT }));

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('location', { ...window.location, reload });
  });
  afterEach(() => {
    reload.mockReset();
    fetchSpy.mockClear();
    vi.unstubAllGlobals();
  });

  it('reports the chunk error and then reloads once', () => {
    render(<Reporter error={chunkError()} />);
    expect(fetchSpy).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    const [firstPost] = fetchSpy.mock.invocationCallOrder;
    const [firstReload] = reload.mock.invocationCallOrder;
    expect(firstPost).toBeLessThan(firstReload ?? Number.NEGATIVE_INFINITY);
  });

  it('does not reload when the guard is already spent', () => {
    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(Date.now()));
    render(<Reporter error={chunkError()} />);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload for an error that is not a chunk load failure', () => {
    render(<Reporter error={new Error('boom')} />);
    expect(reload).not.toHaveBeenCalled();
  });
});
