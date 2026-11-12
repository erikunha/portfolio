import { argosScreenshot } from '@argos-ci/playwright';
import type { Locator, Page } from '@playwright/test';
import { volatileMasks } from './mask-volatile';

/**
 * The capture that goes to the cloud has to mask what the repository baseline
 * masks. The session counters, the blinking caret and the boot line change on
 * every run, so a capture that keeps them turns every build into a diff, and
 * the diff says nothing about the change that was made.
 */
export async function captureForArgos(page: Page, name: string, element: Locator): Promise<void> {
  await argosScreenshot(page, name, { element, mask: volatileMasks(page) });
}
