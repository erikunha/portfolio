// __tests__/sysfail-loop.test.ts
import { describe, expect, it, vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});

describe('runBoot onFirstLoop', () => {
  it('fires exactly once across multiple dialog loops', async () => {
    // runBoot extracted from HeroBootAnimation island to lib/boot-animation (pure, no React).
    const { runBoot } = await import('../lib/boot-animation');
    const container = document.createElement('div');
    const calls: number[] = [];

    const ctrl = runBoot(container, [[' ']], ['Hi', 'Yo'], {
      lineMs: 0,
      lineJitter: 0,
      cmdMs: 0,
      cmdJitter: 0,
      typeMs: 0,
      holdMs: 0,
      backMs: 0,
      interMs: 0,
      startMs: 0,
      onFirstLoop: () => calls.push(Date.now()),
    });

    await new Promise((r) => setTimeout(r, 1200));
    ctrl.cancel();
    expect(calls.length).toBe(1);
  });
});
