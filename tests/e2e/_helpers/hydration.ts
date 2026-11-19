import type { ElementHandle, Page } from '@playwright/test';
import { gotoSettled } from './streamed';

export const REACT_FIBER_KEY_PREFIX = '__reactFiber$';
const FIBER_PLACEMENT_FLAG = 0b10;
const FIBER_HYDRATING_FLAG = 0b1_0000_0000_0000;
const FIBER_UNCOMMITTED_FLAGS = FIBER_PLACEMENT_FLAG | FIBER_HYDRATING_FLAG;
const FIBER_HOST_ROOT_TAG = 3;

export const MENU_TRIGGER = '.menu-trigger';
export const DOCK_MENU = '.dock button[aria-controls="section-drawer"]';
export const MOTION_TOPBAR_TOGGLE = '.desktop-topbar button[aria-pressed]';
export const MOBILE_BAR_CONTROL = '.mobile-title-bar button';
export const STATUS_BAR = '.status-bar';

const MENU_TRIGGER_NAME = /^(Open menu|Abrir menu)$/;

function nextFrame(page: Page): Promise<void> {
  return page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

type FiberLike = {
  flags: number;
  tag: number;
  return: FiberLike | null;
  alternate: FiberLike | null;
};

export type CommittedArgs = readonly [string | Element, string, number, number];

export const COMMITTED_CONSTANTS = [
  REACT_FIBER_KEY_PREFIX,
  FIBER_UNCOMMITTED_FLAGS,
  FIBER_HOST_ROOT_TAG,
] as const;

export function isCommittedToReact([target, prefix, uncommittedFlags, hostRootTag]: CommittedArgs) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (node === null) return false;
  const key = Object.keys(node).find((name) => name.startsWith(prefix));
  if (key === undefined) return false;
  const host = (node as unknown as Record<string, FiberLike>)[key] as FiberLike;
  let nearestMounted: FiberLike = host;
  let top: FiberLike = host;
  let next: FiberLike | null = host;
  while (next !== null && next.alternate === null) {
    top = next;
    if ((top.flags & uncommittedFlags) !== 0) nearestMounted = top.return as FiberLike;
    next = top.return;
  }
  while (top.return !== null) top = top.return;
  return top.tag === hostRootTag && nearestMounted === host;
}

async function waitForCommit(page: Page, target: string | ElementHandle): Promise<void> {
  await page.waitForFunction(isCommittedToReact as (args: unknown) => boolean, [
    target,
    ...COMMITTED_CONSTANTS,
  ]);
}

export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await waitForCommit(page, selector);
  await nextFrame(page);
}

export async function gotoHydrated(
  page: Page,
  path: string,
  controlSelectors: string | readonly string[],
  options?: Parameters<Page['goto']>[1],
): Promise<Awaited<ReturnType<Page['goto']>>> {
  const response = await gotoSettled(page, path, options);
  for (const selector of [controlSelectors].flat()) {
    await waitForHydration(page, selector);
  }
  return response;
}

export async function openSectionMenu(page: Page): Promise<void> {
  const trigger = page
    .getByRole('button', { name: MENU_TRIGGER_NAME })
    .filter({ visible: true })
    .first();
  const node = await trigger.elementHandle();
  await waitForCommit(page, node);
  await nextFrame(page);
  await trigger.click();
}
