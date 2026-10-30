import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SECTION_REGISTRY } from '@/content/section-registry';
import { SectionNavigationProvider } from '../SectionNavigation';
import { PositionMeter } from './PositionMeter.client';

let notify: IntersectionObserverCallback | undefined;

class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    notify = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe = (element: Element) => {
    this.observed.push(element);
  };
  disconnect = () => {
    this.disconnected = true;
  };
}

const PAGE_HEIGHT = 5000;
const VIEWPORT_HEIGHT = 1000;

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

async function frame() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 32));
  });
}

function mount() {
  return render(
    <SectionNavigationProvider>
      <nav className="dock" data-position-target="" />
      <PositionMeter />
      {SECTION_REGISTRY.map(({ id }) => (
        <section key={id} id={id} />
      ))}
    </SectionNavigationProvider>,
  );
}

describe('PositionMeter', () => {
  beforeEach(() => {
    notify = undefined;
    FakeResizeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: PAGE_HEIGHT,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_HEIGHT, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a named progressbar from 0 to 100 that starts at the top', () => {
    mount();
    const bar = screen.getByRole('progressbar', { name: 'Page position' });
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });

  it('follows the scroll position and reaches 100 at the end of the page', async () => {
    mount();
    const bar = screen.getByRole('progressbar');
    scrollTo(2000);
    await frame();
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    scrollTo(PAGE_HEIGHT - VIEWPORT_HEIGHT);
    await frame();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    scrollTo(PAGE_HEIGHT * 2);
    await frame();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('reports 0 when the page does not scroll', async () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: VIEWPORT_HEIGHT,
      configurable: true,
    });
    mount();
    scrollTo(300);
    await frame();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('writes the fraction to every position target, including the dock strip', async () => {
    const { container } = mount();
    scrollTo(2000);
    await frame();
    const targets = container.querySelectorAll<HTMLElement>('[data-position-target]');
    expect(targets.length).toBeGreaterThanOrEqual(2);
    for (const target of targets) expect(target.style.getPropertyValue('--posf')).toBe('0.5');
  });

  it('coalesces a burst of scroll events into the latest value', async () => {
    mount();
    scrollTo(500);
    scrollTo(1000);
    scrollTo(3000);
    await frame();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('75');
  });

  it('labels the current section as NN/9 outside any live region', () => {
    const { container } = mount();
    expect(screen.getByText('01/9')).not.toBeNull();
    const target = document.getElementById('sec-shell');
    act(() => {
      notify?.(
        [{ target, isIntersecting: true }] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });
    const label = screen.getByText('05/9');
    expect(label.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    expect(container.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('recomputes when the document height changes without a scroll or resize', async () => {
    mount();
    const bar = screen.getByRole('progressbar');
    scrollTo(1000);
    await frame();
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    const watcher = FakeResizeObserver.instances[0];
    expect(watcher?.observed).toEqual([document.body]);
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });
    act(() => watcher?.callback([], watcher as unknown as ResizeObserver));
    await frame();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('works without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mount();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('removes what it wrote on the position targets and disconnects when unmounted', async () => {
    const view = mount();
    scrollTo(2000);
    await frame();
    const targets = [...view.container.querySelectorAll<HTMLElement>('[data-position-target]')];
    expect(targets.every((target) => target.style.getPropertyValue('--posf') === '0.5')).toBe(true);
    const dock = view.container.querySelector<HTMLElement>('.dock') as HTMLElement;
    view.unmount();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(dock.style.getPropertyValue('--posf')).toBe('');
  });

  it('stops listening when unmounted', async () => {
    const view = mount();
    const remove = vi.spyOn(window, 'removeEventListener');
    view.unmount();
    expect(remove.mock.calls.map(([type]) => type)).toContain('scroll');
  });
});
