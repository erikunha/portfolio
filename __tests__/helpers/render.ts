import { act, type ReactElement } from 'react';

export interface MountedClient {
  container: HTMLElement;
  root: import('react-dom/client').Root;
  unmount: () => void;
}

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

export async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

export async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 32));
  });
}

export async function hydrateClient(
  element: ReactElement,
  typeIntoServerMarkup: (container: HTMLElement) => void,
): Promise<MountedClient> {
  const { renderToString } = await import('react-dom/server');
  const { hydrateRoot } = await import('react-dom/client');

  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.appendChild(container);
  typeIntoServerMarkup(container);

  let root: import('react-dom/client').Root | undefined;
  await act(async () => {
    root = hydrateRoot(container, element);
  });
  const mountedRoot = root as import('react-dom/client').Root;

  const unmount = (): void => {
    act(() => mountedRoot.unmount());
    container.remove();
  };

  return { container, root: mountedRoot, unmount };
}
