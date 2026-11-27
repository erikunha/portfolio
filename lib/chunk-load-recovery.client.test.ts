import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RECOVERY_STORAGE_KEY,
  CHUNK_RECOVERY_WINDOW_MS,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from '@/lib/chunk-load-recovery.client';

const TURBOPACK_MESSAGE =
  'Failed to load chunk /_next/static/immutable/chunks/3pjezcwcinob5.js from module 44391';
const WEBPACK_MESSAGE = 'Loading chunk 187 failed.';
const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);

function chunkError(message = TURBOPACK_MESSAGE): Error {
  const error = new Error(message);
  error.name = 'ChunkLoadError';
  return error;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('isChunkLoadError', () => {
  it.each([
    ['a ChunkLoadError by name', chunkError('anything')],
    ['a Turbopack message without the name', new Error(TURBOPACK_MESSAGE)],
    ['a webpack message without the name', new Error(WEBPACK_MESSAGE)],
    ['a webpack CSS chunk message', new Error('Loading CSS chunk 9 failed.')],
    ['a window error message string', `Uncaught ChunkLoadError: ${TURBOPACK_MESSAGE}`],
  ])('accepts %s', (_label, value) => {
    expect(isChunkLoadError(value)).toBe(true);
  });

  it.each([
    ['an unrelated TypeError', new TypeError('x is not a function')],
    ['a network failure of an API call', new Error('Failed to fetch')],
    ['a string without the signature', 'Script error.'],
    ['null', null],
    ['undefined', undefined],
    ['a plain object', { message: TURBOPACK_MESSAGE }],
  ])('rejects %s', (_label, value) => {
    expect(isChunkLoadError(value)).toBe(false);
  });
});

describe('recoverFromChunkLoadError', () => {
  const reload = vi.fn();
  let storage = memoryStorage();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    storage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage: storage, location: { reload } });
  });
  afterEach(() => {
    reload.mockReset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reloads once and stamps the guard on the first chunk failure', () => {
    expect(recoverFromChunkLoadError(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.store.get(CHUNK_RECOVERY_STORAGE_KEY)).toBe(String(NOW));
  });

  it('does not reload a second time inside the window', () => {
    recoverFromChunkLoadError(chunkError());
    vi.setSystemTime(NOW + CHUNK_RECOVERY_WINDOW_MS - 1);
    expect(recoverFromChunkLoadError(chunkError())).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again once the window has passed', () => {
    recoverFromChunkLoadError(chunkError());
    vi.setSystemTime(NOW + CHUNK_RECOVERY_WINDOW_MS);
    expect(recoverFromChunkLoadError(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('treats a stamp from the future as spent', () => {
    storage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(NOW + CHUNK_RECOVERY_WINDOW_MS * 10));
    expect(recoverFromChunkLoadError(chunkError())).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('ignores a stamp that is not a number', () => {
    storage.setItem(CHUNK_RECOVERY_STORAGE_KEY, 'garbage');
    expect(recoverFromChunkLoadError(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('leaves any other error alone', () => {
    expect(recoverFromChunkLoadError(new TypeError('x is not a function'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.store.size).toBe(0);
  });

  it('does not reload when the guard cannot be written', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
      },
      location: { reload },
    });
    expect(recoverFromChunkLoadError(chunkError())).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when the guard cannot be read', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
        setItem: vi.fn(),
      },
      location: { reload },
    });
    expect(recoverFromChunkLoadError(chunkError())).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
