// components/client/HeroSystemFailure/HeroSystemFailure.test.tsx
import { describe, expect, it, vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});

// Minimal BootClasses fixture for unit tests — class names are arbitrary strings;
// the test only verifies timing/firing behavior, not DOM class values.
const testCls = {
  bootLine: 'bootLine',
  bootOk: 'bootOk',
  bootEnc: 'bootEnc',
  bootWelcome: 'bootWelcome',
  bootPrompt: 'bootPrompt',
  bootCmd: 'bootCmd',
  bootMatrixPrefix: 'bootMatrixPrefix',
  bootMatrixOut: 'bootMatrixOut',
  bootCursor: 'bootCursor',
  shake: 'shake',
  shake2: 'shake2',
} as const;

describe('runBoot onFirstLoop', () => {
  it('fires exactly once across multiple dialog loops', async () => {
    // runBoot extracted from HeroBootAnimation island to lib/boot-animation (pure, no React).
    const { runBoot } = await import('@/lib/boot-animation');
    const container = document.createElement('div');
    const calls: number[] = [];

    const ctrl = runBoot(container, [[' ']], ['Hi', 'Yo'], testCls, {
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
