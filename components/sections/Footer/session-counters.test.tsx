import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHELL_COMMAND_EVENT } from '@/lib/events';
import { useCommandCount, useScrollDepth, useSeenSections, useUptime } from './session-counters';

const SECONDS_65 = 65_000;
const HALF_SCROLL = 500;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

const NO_ROOT = { current: null };

function Harness({ hook, sectionIds }: { hook: string; sectionIds?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useUptime(hook === 'uptime' ? ref : NO_ROOT);
  useScrollDepth(hook === 'depth' ? ref : NO_ROOT);
  useCommandCount(hook === 'commands' ? ref : NO_ROOT);
  useSeenSections(hook === 'seen' ? ref : NO_ROOT, sectionIds ?? []);
  return (
    <div ref={ref}>
      <b data-sess="uptime" />
      <b data-sess="depth" />
      <b data-sess="commands" />
      <b data-sess="seen" />
      <meter min={0} max={100} value={0} />
    </div>
  );
}

function field(container: HTMLElement, name: string) {
  return container.querySelector(`[data-sess="${name}"]`);
}

let frames: FrameRequestCallback[];

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('IntersectionObserver', undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useUptime', () => {
  it('writes the formatted session time on mount and every second', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(SECONDS_65);
    const mounted = render(<Harness hook="uptime" />);
    expect(field(mounted.container, 'uptime')?.textContent).toBe('00:01:05');
    now.mockReturnValue(SECONDS_65 + 3000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(field(mounted.container, 'uptime')?.textContent).toBe('00:01:08');
    mounted.unmount();
  });

  it('pauses while hidden and ticks immediately when visible again', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(SECONDS_65);
    const mounted = render(<Harness hook="uptime" />);
    act(() => setVisibility('hidden'));
    now.mockReturnValue(SECONDS_65 + 10_000);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(field(mounted.container, 'uptime')?.textContent).toBe('00:01:05');
    act(() => setVisibility('visible'));
    expect(field(mounted.container, 'uptime')?.textContent).toBe('00:01:15');
    mounted.unmount();
  });

  it('does not start an interval when mounted in a hidden tab', () => {
    setVisibility('hidden');
    const now = vi.spyOn(performance, 'now').mockReturnValue(SECONDS_65);
    const mounted = render(<Harness hook="uptime" />);
    now.mockReturnValue(SECONDS_65 + 9000);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(field(mounted.container, 'uptime')?.textContent).toBe('00:01:05');
    mounted.unmount();
  });

  it('stops ticking and drops its listener on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const now = vi.spyOn(performance, 'now').mockReturnValue(SECONDS_65);
    const mounted = render(<Harness hook="uptime" />);
    const node = field(mounted.container, 'uptime');
    mounted.unmount();
    now.mockReturnValue(SECONDS_65 + 9000);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(node?.textContent).toBe('00:01:05');
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});

describe('useScrollDepth', () => {
  function scrollTo(position: number) {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);
    vi.stubGlobal('scrollY', position);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      for (const frame of frames.splice(0)) frame(0);
    });
  }

  it('writes the deepest percentage to the label and the meter and never decreases', () => {
    const mounted = render(<Harness hook="depth" />);
    scrollTo(HALF_SCROLL);
    expect(field(mounted.container, 'depth')?.textContent).toBe('50%');
    expect(mounted.container.querySelector('meter')?.value).toBe(50);
    scrollTo(100);
    expect(field(mounted.container, 'depth')?.textContent).toBe('50%');
    mounted.unmount();
  });

  it('removes its scroll listener and cancels a pending frame on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const cancel = vi.mocked(cancelAnimationFrame);
    const mounted = render(<Harness hook="depth" />);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    cancel.mockClear();
    mounted.unmount();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(cancel).toHaveBeenCalled();
  });
});

describe('useCommandCount', () => {
  it('counts shell commands into its node and ignores them after unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const mounted = render(<Harness hook="commands" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(SHELL_COMMAND_EVENT));
      window.dispatchEvent(new CustomEvent(SHELL_COMMAND_EVENT));
    });
    const node = field(mounted.container, 'commands');
    expect(node?.textContent).toBe('2');
    mounted.unmount();
    act(() => {
      window.dispatchEvent(new CustomEvent(SHELL_COMMAND_EVENT));
    });
    expect(node?.textContent).toBe('2');
    expect(remove).toHaveBeenCalledWith(SHELL_COMMAND_EVENT, expect.any(Function));
  });
});

describe('useSeenSections', () => {
  it('writes the count of distinct sections entered and disconnects on unmount', () => {
    let notify: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const first = document.createElement('section');
    first.id = 'seen-a';
    const second = document.createElement('section');
    second.id = 'seen-b';
    document.body.append(first, second);
    const mounted = render(<Harness hook="seen" sectionIds={['seen-a', 'seen-b']} />);
    const entries = [first, second, first].map((target) => ({
      target,
      isIntersecting: true,
    })) as unknown as IntersectionObserverEntry[];
    act(() => notify?.(entries, {} as IntersectionObserver));
    expect(field(mounted.container, 'seen')?.textContent).toBe('2');
    mounted.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    first.remove();
    second.remove();
  });
});
