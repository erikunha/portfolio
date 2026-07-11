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
