import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/components/responsive/MatrixRain', () => ({
  MatrixRain: () => null,
}));
vi.mock('@/components/responsive/CRTOverlay', () => ({
  CRTOverlay: () => null,
}));
vi.mock('@/components/responsive/DesktopTopbar', () => ({
  DesktopTopbar: () => null,
}));
vi.mock('@/components/responsive/StatusBar', () => ({
  StatusBar: () => null,
}));
vi.mock('@/components/responsive/MobileTitleBar', () => ({
  MobileTitleBar: () => null,
}));
vi.mock('@/components/responsive/Dock', () => ({
  Dock: () => null,
}));
vi.mock('@/components/client/ToTopButton', () => ({
  ToTopButton: () => null,
}));
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

describe('AppShell — module:open delegated handler', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('opens a <details> element whose id matches the event detail.id', async () => {
    const { AppShell } = await import('@/components/AppShell/AppShell.client');

    const details = document.createElement('details');
    details.id = 'my-module';
    document.body.appendChild(details);
    expect(details.open).toBe(false);

    mounted = await mountClient(createElement(AppShell, null));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('module:open', { detail: { id: 'my-module' } }));
    });

    expect(details.open).toBe(true);

    document.body.removeChild(details);
  });

  it('does nothing if the target element is not a <details>', async () => {
    const { AppShell } = await import('@/components/AppShell/AppShell.client');

    const div = document.createElement('div');
    div.id = 'not-a-details';
    document.body.appendChild(div);

    mounted = await mountClient(createElement(AppShell, null));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('module:open', { detail: { id: 'not-a-details' } }));
    });

    expect((div as unknown as HTMLDetailsElement).open).toBeUndefined();

    document.body.removeChild(div);
  });

  it('removes the module:open listener on unmount', async () => {
    const { AppShell } = await import('@/components/AppShell/AppShell.client');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    mounted = await mountClient(createElement(AppShell, null));
    mounted.unmount();

    expect(removeSpy).toHaveBeenCalledWith('module:open', expect.any(Function));
  });
});
