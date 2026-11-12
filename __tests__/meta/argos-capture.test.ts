import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

const argosScreenshot = vi.fn();

vi.mock('@argos-ci/playwright', () => ({
  argosScreenshot: (...args: unknown[]) => argosScreenshot(...args),
}));

const { captureForArgos } = await import('../../tests/e2e/_helpers/argos-capture');
const { volatileMasks } = await import('../../tests/e2e/_helpers/mask-volatile');

const HELPERS_DIR = join(__dirname, '..', '..', 'tests', 'e2e', '_helpers');
const VISUAL_SPEC = join(__dirname, '..', '..', 'tests', 'visual', 'visual.spec.ts');
const REPOSITORY_CAPTURE_SCALE = 'css';

function fakePage(): Page {
  return {
    locator: (selector: string) => ({ selector }) as unknown as Locator,
  } as unknown as Page;
}

async function lastCaptureOptions(): Promise<Record<string, unknown>> {
  argosScreenshot.mockClear();
  await captureForArgos(fakePage(), 'footer', { selector: '#sec-footer' } as unknown as Locator);
  expect(argosScreenshot).toHaveBeenCalledTimes(1);
  const [, , options] = argosScreenshot.mock.calls[0] as [Page, string, Record<string, unknown>];
  return options;
}

describe('the capture that goes to Argos', () => {
  it('passes the page, the name and the element through', async () => {
    argosScreenshot.mockClear();
    const page = fakePage();
    const element = { selector: '#sec-footer' } as unknown as Locator;
    await captureForArgos(page, 'footer', element);

    const [capturedPage, name, options] = argosScreenshot.mock.calls[0] as [
      Page,
      string,
      Record<string, unknown>,
    ];
    expect(capturedPage).toBe(page);
    expect(name).toBe('footer');
    expect(options.element).toBe(element);
  });

  it('masks exactly what the repository baseline masks, entry for entry', async () => {
    const options = await lastCaptureOptions();
    const expected = volatileMasks(fakePage());

    expect(expected.length, 'the baseline mask is not empty').toBeGreaterThan(0);
    expect(options.mask, 'the capture carries a mask').toBeDefined();
    expect(options.mask).toEqual(expected);
  });

  it('captures at CSS pixels, so a high density screen does not magnify the glyphs the baseline sees at 1x', async () => {
    const options = await lastCaptureOptions();
    expect(options.scale).toBe(REPOSITORY_CAPTURE_SCALE);
  });

  it('hides the decorative canvases with the stylesheet the baseline injects', async () => {
    const options = await lastCaptureOptions();
    const stylesheet = readFileSync(join(HELPERS_DIR, 'hide-decorative-canvas.css'), 'utf8');

    expect(stylesheet).toContain('canvas[aria-hidden]');
    expect(options.argosCSS).toBe(stylesheet);
  });

  it('is the only way the visual spec reaches Argos', () => {
    const spec = readFileSync(VISUAL_SPEC, 'utf8');
    expect(spec).not.toMatch(/@argos-ci\/playwright/);
    expect(spec).not.toMatch(/\bargosScreenshot\b/);
  });
});
