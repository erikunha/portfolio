import type { BrowserContext, Page } from '@playwright/test';
import { MOTION_CHOICE, MOTION_STORAGE_KEY } from '@/lib/motion-change';

export { MOTION_CHOICE, MOTION_STORAGE_KEY };

export type MotionChoice = (typeof MOTION_CHOICE)[keyof typeof MOTION_CHOICE];

export async function seedMotionChoice(
  target: Page | BrowserContext,
  choice: MotionChoice,
): Promise<void> {
  await target.addInitScript(
    ([key, value]) => {
      try {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        // biome-ignore lint/suspicious/noEmptyBlockStatements: storage can be blocked on about:blank
      } catch {}
    },
    [MOTION_STORAGE_KEY, choice] as const,
  );
}

export async function freezeMotion(target: Page | BrowserContext): Promise<void> {
  await seedMotionChoice(target, MOTION_CHOICE.off);
}
