import { describe, expect, it } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';

installMatchMedia(false);

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
