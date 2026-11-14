import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_CHOICE, MOTION_STORAGE_KEY } from '@/lib/motion-change';
import { NavProgress } from './NavProgress.client';

const RUN_MS = 300;
const JUST_BEFORE_END_MS = RUN_MS - 1;

function bar(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.links-progress');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function appendTo(parent: HTMLElement, html: string): HTMLElement {
  parent.insertAdjacentHTML('beforeend', html);
  return parent.lastElementChild as HTMLElement;
}

function clickOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('NavProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    document.body.replaceChildren();
  });

  it('renders an idle bar hidden from assistive technology', () => {
    const { container } = render(<NavProgress />);

    expect(bar(container).getAttribute('data-running')).toBe('false');
    expect(bar(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('runs for 300 ms after a click on an outbound link, then goes idle', () => {
    const { container } = render(<NavProgress />);
    const link = appendTo(document.body, '<a data-outbound href="https://example.test">x</a>');

    clickOn(link);
    expect(bar(container).getAttribute('data-running')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(JUST_BEFORE_END_MS);
    });
    expect(bar(container).getAttribute('data-running')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(bar(container).getAttribute('data-running')).toBe('false');
  });

  it('runs for a click on an element inside an outbound link', () => {
    const { container } = render(<NavProgress />);
    const link = appendTo(
      document.body,
      '<a data-outbound href="https://example.test"><span>x</span></a>',
    );

    clickOn(link.querySelector('span') as HTMLElement);

    expect(bar(container).getAttribute('data-running')).toBe('true');
  });

  it('restarts the 300 ms run on a second click', () => {
    const { container } = render(<NavProgress />);
    const link = appendTo(document.body, '<a data-outbound href="https://example.test">x</a>');

    clickOn(link);
    act(() => {
      vi.advanceTimersByTime(RUN_MS - 100);
    });
    clickOn(link);
    act(() => {
      vi.advanceTimersByTime(RUN_MS - 100);
    });

    expect(bar(container).getAttribute('data-running')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(bar(container).getAttribute('data-running')).toBe('false');
  });

  it('ignores a click on a link that is not outbound', () => {
    const { container } = render(<NavProgress />);
    const link = appendTo(document.body, '<a href="/links">x</a>');

    clickOn(link);

    expect(bar(container).getAttribute('data-running')).toBe('false');
  });

  it('ignores a click whose target is not an element', () => {
    const { container } = render(<NavProgress />);

    clickOn(document);

    expect(bar(container).getAttribute('data-running')).toBe('false');
  });

  it('stays idle while the MOTION switch is off', () => {
    localStorage.setItem(MOTION_STORAGE_KEY, MOTION_CHOICE.off);
    const { container } = render(<NavProgress />);
    const link = appendTo(document.body, '<a data-outbound href="https://example.test">x</a>');

    clickOn(link);

    expect(bar(container).getAttribute('data-running')).toBe('false');
  });

  it('removes its click listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<NavProgress />);
    const link = appendTo(document.body, '<a data-outbound href="https://example.test">x</a>');

    clickOn(link);
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });
});
