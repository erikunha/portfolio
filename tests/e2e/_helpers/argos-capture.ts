import { argosScreenshot } from '@argos-ci/playwright';
import type { Locator, Page } from '@playwright/test';
import { CAPTURE_SCALE, hideDecorativeCanvasCss } from './capture-options';
import { volatileMasks } from './mask-volatile';

/**
 * The capture that goes to the cloud has to look at the page the way the
 * repository baseline does: the same mask over what changes on every run, the
 * same CSS pixel scale and the same stylesheet over the decorative canvases.
 * A capture that differs in any of them makes the cloud diff disagree with the
 * repository gate about pixels that did not change.
 */
export async function captureForArgos(page: Page, name: string, element: Locator): Promise<void> {
  await argosScreenshot(page, name, {
    element,
    mask: volatileMasks(page),
    scale: CAPTURE_SCALE,
    argosCSS: hideDecorativeCanvasCss(),
  });
}
