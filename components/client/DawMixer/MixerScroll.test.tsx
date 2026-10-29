import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MixerScroll } from './MixerScroll.client';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MixerScroll', () => {
  it.each([
    [320, 320, null],
    [600, 320, '0'],
    [600, 1100, null],
  ])('measures initial content %ipx in a %ipx viewport', (content, viewport, tabIndex) => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(content);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(viewport);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    render(
      <MixerScroll aria-label="Mixer channels">
        <div>Six channels</div>
      </MixerScroll>,
    );
    const region = screen.getByRole('region', { name: 'Mixer channels' });
    expect(region.getAttribute('tabindex')).toBe(tabIndex);
  });

  it('tracks viewport and content resizing and disconnects on unmount', () => {
    let content = 600;
    let viewport = 320;
    let resize: () => void = vi.fn();
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => content);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => viewport);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );

    const { unmount } = render(
      <MixerScroll id="mixer-demo" className="custom" aria-label="Mixer channels">
        <div data-testid="channel-grid">Six channels</div>
      </MixerScroll>,
    );
    const region = screen.getByRole('region', { name: 'Mixer channels' });
    expect(region.id).toBe('mixer-demo');
    expect(region.classList.contains('custom')).toBe(true);
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(observe).toHaveBeenCalledWith(region);
    expect(observe).toHaveBeenCalledWith(screen.getByTestId('channel-grid'));

    viewport = 600;
    act(() => resize());
    expect(region.hasAttribute('tabindex')).toBe(false);

    content = 601;
    act(() => resize());
    expect(region.getAttribute('tabindex')).toBe('0');

    content = 599;
    act(() => resize());
    expect(region.hasAttribute('tabindex')).toBe(false);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
