import type { JSHandle, Page } from '@playwright/test';
import { COMMITTED_CONSTANTS, isCommittedToReact, REACT_FIBER_KEY_PREFIX } from './hydration';
import { nodeInCommittedTree, ROOTS_KEY } from './react-commit-oracle';

const SAMPLES_KEY = '__fiberWriteSamples';

export type FiberWriteSample = { helper: boolean; oracle: boolean; error?: string };

async function intoPage<Fn>(page: Page, fn: Fn): Promise<JSHandle<Fn>> {
  return page.evaluateHandle<Fn>(`(${String(fn)})`);
}

export async function trapFiberWrite(
  page: Page,
  selector: string,
): Promise<() => Promise<FiberWriteSample[]>> {
  const helper = await intoPage(page, isCommittedToReact);
  const oracle = await intoPage(page, nodeInCommittedTree);
  await page.waitForFunction(
    (prefix) =>
      [...document.querySelectorAll('*')].some((element) =>
        Object.keys(element).some((name) => name.startsWith(prefix)),
      ),
    REACT_FIBER_KEY_PREFIX,
  );
  await page.evaluate(
    ([target, prefix, constants, rootsKey, samplesKey, helperFn, oracleFn]) => {
      const island = document.querySelector(target) as Element;
      const shellNode = [...document.querySelectorAll('*')].find((element) =>
        Object.keys(element).some((name) => name.startsWith(prefix)),
      ) as Element;
      const key = Object.keys(shellNode).find((name) => name.startsWith(prefix)) as string;
      const samples: FiberWriteSample[] = [];
      let stored: unknown;
      Object.assign(window, { [samplesKey]: samples });
      Object.defineProperty(island, key, {
        configurable: true,
        enumerable: false,
        get: () => stored,
        set: (value: unknown) => {
          stored = value;
          Object.defineProperty(island, key, { enumerable: true });
          try {
            samples.push({
              helper: helperFn([island, ...constants]),
              oracle: oracleFn([island, rootsKey]),
            });
          } catch (cause) {
            samples.push({ helper: false, oracle: false, error: String(cause) });
          }
        },
      });
    },
    [
      selector,
      REACT_FIBER_KEY_PREFIX,
      COMMITTED_CONSTANTS,
      ROOTS_KEY,
      SAMPLES_KEY,
      helper,
      oracle,
    ] as const,
  );
  return () =>
    page.evaluate(
      (samplesKey) =>
        (window as unknown as Record<string, FiberWriteSample[]>)[samplesKey] as FiberWriteSample[],
      SAMPLES_KEY,
    );
}
