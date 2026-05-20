// __tests__/helpers/render.ts
// Shared jsdom client-render plumbing for behavioral tests (CG3).
//
// ~10 rewritten test files re-implemented the identical mount/unmount/flush
// boilerplate: create a container <div>, append it, createRoot + render under
// act(), then unmount + remove on teardown, plus a microtask drain that lets
// React 19 effects commit in jsdom. This helper centralizes that plumbing so
// each suite keeps only its behavioral assertions.
//
// NOTE: this is a helper, not a *.test.ts file — Vitest does not run it as a
// suite, and the no-source-grep meta-check (which only scans *.test.ts) does
// not apply to it.

import { act, type ReactElement } from 'react';

export interface MountedClient {
  /** The container <div> the element was rendered into (appended to body). */
  container: HTMLElement;
  /** The React root created for this mount. */
  root: import('react-dom/client').Root;
  /** Unmounts the root (under act) and removes the container from the DOM. */
  unmount: () => void;
}

/**
 * Mounts a React element into a fresh jsdom container.
 *
 * Creates a container <div>, appends it to document.body, creates a React root
 * and renders the element under `act()` so effects commit before the call
 * resolves. Returns the container, root, and an `unmount()` teardown.
 *
 * The `react-dom/client` import is done dynamically here so suites that call
 * `vi.resetModules()` in `beforeEach` still pick up a fresh module graph.
 */
export async function mountClient(element: ReactElement): Promise<MountedClient> {
  const { createRoot } = await import('react-dom/client');

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  const unmount = (): void => {
    act(() => root.unmount());
    container.remove();
  };

  return { container, root, unmount };
}

/**
 * Drains the microtask/macrotask queue so React 19 effects commit in jsdom.
 *
 * One `setTimeout(0)` tick wrapped in `act()` so any state updates it triggers
 * are flushed — this matches the single-tick `flush()` the rewritten suites
 * used. Some suites call this twice in sequence (e.g. to let an effect run and
 * then settle a follow-up update); call it once per tick you need so timing-
 * sensitive assertions stay observable between drains.
 */
export async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}
