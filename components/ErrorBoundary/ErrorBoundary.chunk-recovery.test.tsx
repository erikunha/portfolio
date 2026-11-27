import { act, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyIsland } from '@/components/client/LazyIsland';
import { CHUNK_RECOVERY_STORAGE_KEY } from '@/lib/chunk-load-recovery.client';
import { ErrorBoundary } from './ErrorBoundary.client';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const CHUNK_MESSAGE =
  'Failed to load chunk /_next/static/immutable/chunks/3pjezcwcinob5.js from module 44391';
const HTTP_NO_CONTENT = 204;

function chunkError(): Error {
  const error = new Error(CHUNK_MESSAGE);
  error.name = 'ChunkLoadError';
  return error;
}

function CrashWith({ error }: { error: Error }): never {
  throw error;
}

function posted(fetchSpy: ReturnType<typeof vi.fn>): string[] {
  return fetchSpy.mock.calls.map(([, init]) => String((init as RequestInit).body));
}

describe('chunk load recovery', () => {
  const reload = vi.fn();
  const fetchSpy = vi.fn(async () => new Response(null, { status: HTTP_NO_CONTENT }));

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('location', { ...window.location, reload });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    reload.mockReset();
    fetchSpy.mockClear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reloads once when the boundary catches a chunk load error and still reports it', () => {
    render(
      <ErrorBoundary>
        <CrashWith error={chunkError()} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(posted(fetchSpy).some((body) => body.includes(CHUNK_MESSAGE))).toBe(true);
  });

  it('shows the fallback and does not reload again once the guard is spent', () => {
    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(Date.now()));
    render(
      <ErrorBoundary>
        <CrashWith error={chunkError()} />
      </ErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(posted(fetchSpy).some((body) => body.includes(CHUNK_MESSAGE))).toBe(true);
  });

  it('does not reload for an ordinary render error', () => {
    render(
      <ErrorBoundary>
        <CrashWith error={new Error('island crash')} />
      </ErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads when a lazy island import rejects with a chunk load error', async () => {
    const Island = lazy(() => Promise.reject(chunkError()));
    await act(async () => {
      render(
        <LazyIsland loading={<p>loading</p>}>
          <Island />
        </LazyIsland>,
      );
    });
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ['carries the error object', chunkError()],
    ['carries only the message', null],
  ])('reloads when a window error %s', async (_label, error) => {
    await import('@/lib/error-bridge.client');
    window.dispatchEvent(
      Object.assign(new Event('error'), {
        message: `Uncaught ChunkLoadError: ${CHUNK_MESSAGE}`,
        error,
      }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(posted(fetchSpy).some((body) => body.includes(CHUNK_MESSAGE))).toBe(true);
    });
  });

  it('reloads when a chunk load rejection is unhandled', async () => {
    await import('@/lib/error-bridge.client');
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: chunkError() }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload from the bridge when the guard is spent or the error is unrelated', async () => {
    await import('@/lib/error-bridge.client');
    window.dispatchEvent(
      Object.assign(new Event('error'), { message: 'boom', error: new Error('boom') }),
    );
    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(Date.now()));
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: chunkError() }));
    expect(reload).not.toHaveBeenCalled();
  });
});
