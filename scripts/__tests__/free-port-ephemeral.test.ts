import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('node:net');
  vi.resetModules();
});

function bindable(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, () => server.close(() => resolve()));
  });
}

describe('ephemeralPort', () => {
  it('resolves an OS-assigned port that can be bound right after', async () => {
    const { ephemeralPort } = await import('../ci/free-port');
    const port = await ephemeralPort();
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
    await expect(bindable(port)).resolves.toBeUndefined();
  });

  it('rejects when the OS refuses to bind', async () => {
    const refusal = new Error('EACCES');
    vi.doMock('node:net', () => ({
      createServer: () => {
        const fake = new EventEmitter() as EventEmitter & { listen: () => void };
        fake.listen = () => queueMicrotask(() => fake.emit('error', refusal));
        return fake;
      },
    }));
    const { ephemeralPort } = await import('../ci/free-port');
    await expect(ephemeralPort()).rejects.toBe(refusal);
  });
});
