import type { Page } from '@playwright/test';

const HOOK_KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';
export const ROOTS_KEY = '__committedReactRoots';
const RENDERER_ID = 1;

export async function installCommitOracle(page: Page): Promise<void> {
  await page.addInitScript(
    ([hookKey, rootsKey, rendererId]) => {
      const roots = new Set<unknown>();
      Object.assign(window, { [rootsKey]: roots });
      Object.assign(window, {
        [hookKey]: {
          supportsFiber: true,
          renderers: new Map(),
          inject: () => rendererId,
          checkDCE: () => undefined,
          onCommitFiberUnmount: () => undefined,
          onPostCommitFiberRoot: () => undefined,
          onCommitFiberRoot: (_id: number, root: unknown) => {
            roots.add(root);
          },
        },
      });
    },
    [HOOK_KEY, ROOTS_KEY, RENDERER_ID] as const,
  );
}

type Fiber = { stateNode: unknown; child: Fiber | null; sibling: Fiber | null };

export function nodeInCommittedTree([target, rootsKey]: readonly [string | Element, string]) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  const roots = (window as unknown as Record<string, Set<{ current: Fiber }>>)[rootsKey];
  if (node === null || roots === undefined) return false;
  for (const root of roots) {
    const pending: Fiber[] = [root.current];
    for (let fiber = pending.pop(); fiber !== undefined; fiber = pending.pop()) {
      if (fiber.stateNode === node) return true;
      if (fiber.sibling !== null) pending.push(fiber.sibling);
      if (fiber.child !== null) pending.push(fiber.child);
    }
  }
  return false;
}

export function isNodeCommitted(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(nodeInCommittedTree, [selector, ROOTS_KEY] as const);
}
