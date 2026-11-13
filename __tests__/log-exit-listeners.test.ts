import { describe, expect, it, vi } from 'vitest';

const MODULE_LOADS = 12;

describe('lib/log module loads', () => {
  it('does not add a process exit listener per load, so a suite that resets modules never trips the listener cap', async () => {
    await import('@/lib/log');
    const before = process.listenerCount('exit');

    for (let load = 0; load < MODULE_LOADS; load++) {
      vi.resetModules();
      await import('@/lib/log');
    }

    expect(process.listenerCount('exit') - before).toBe(0);
  });
});
