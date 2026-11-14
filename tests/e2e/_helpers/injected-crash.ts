import type { Page } from '@playwright/test';

export const CRASH_SURFACE = {
  route: 'route',
  global: 'global',
} as const;

export type CrashSurface = (typeof CRASH_SURFACE)[keyof typeof CRASH_SURFACE];

export const INJECTED_CRASH_MESSAGE = 'e2e injected crash';

/**
 * Makes one browser API throw once, from an effect React cannot recover from,
 * so the error boundary of a chosen surface renders. The route surface throws
 * from the position meter, which lives inside each page's shell; the global
 * surface throws from the type reveal, which lives in the root layout above
 * every route error boundary. The second call goes through, so a retry
 * recovers. Nothing here ships: the hook exists only in the page the test
 * opens.
 */
export async function crashOnce(page: Page, surface: CrashSurface): Promise<void> {
  await page.addInitScript(
    ([kind, route, message]) => {
      const observer = kind === route ? ResizeObserver : MutationObserver;
      const original = observer.prototype.observe as (
        target: Node,
        options?: MutationObserverInit,
      ) => void;
      let armed = true;
      observer.prototype.observe = function observe(
        this: unknown,
        target: Node,
        options?: MutationObserverInit,
      ) {
        const watchesPage =
          kind === route ? target === document.body : options?.childList && options?.subtree;
        if (armed && watchesPage) {
          armed = false;
          throw new Error(message);
        }
        return original.call(this, target, options);
      } as typeof observer.prototype.observe;
    },
    [surface, CRASH_SURFACE.route, INJECTED_CRASH_MESSAGE] as const,
  );
}
