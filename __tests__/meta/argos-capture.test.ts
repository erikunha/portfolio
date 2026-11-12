import type { Locator, Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

const argosScreenshot = vi.fn();

vi.mock('@argos-ci/playwright', () => ({
  argosScreenshot: (...args: unknown[]) => argosScreenshot(...args),
}));

const { captureForArgos } = await import('../../tests/e2e/_helpers/argos-capture');

type MaskedTarget = { selector: string };

function fakePage(): Page {
  return {
    locator: (selector: string) => ({ selector }) as unknown as Locator,
  } as unknown as Page;
}

describe('the capture that goes to Argos', () => {
  it('masks the volatile elements, so the cloud diff and the repository baseline agree', async () => {
    const element = { selector: '#sec-footer' } as unknown as Locator;
    await captureForArgos(fakePage(), 'footer', element);

    expect(argosScreenshot).toHaveBeenCalledTimes(1);
    const [, name, options] = argosScreenshot.mock.calls[0] as [
      Page,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe('footer');
    expect(options.element).toBe(element);

    const mask = (options.mask as MaskedTarget[]).map((target) => target.selector).join(' ');
    expect(mask, 'the session counters, the caret and the boot line change on every run').toContain(
      '[data-volatile]',
    );
    expect(mask).toContain('shell-cursor');
    expect(mask).toContain('boot-line');
  });
});
