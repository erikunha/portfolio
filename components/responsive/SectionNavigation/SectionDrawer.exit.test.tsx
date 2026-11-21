import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { siteNavChrome } from '@/content/navigation';
import { SECTION_REGISTRY } from '@/content/section-registry';
import { SITE_LOCALE } from '@/content/site-locale';
import { DRAWER_ID } from './navigationIds';
import { SectionNavigation } from './SectionDrawer.client';
import {
  SectionNavigationProvider,
  useSectionNavigation,
} from './SectionNavigationProvider.client';

const LOCALE = SITE_LOCALE.en;
const SCROLL_LOCK = 'data-scroll-locked';
const SLIDE_MS = 200;
const MS_PER_SECOND = 1000;
const FALLBACK_SLACK_MS = 1000;
const EXIT_FALLBACK_SLACK_MS = 50;
const ONE_MS = 1;

function Trigger() {
  const { openDrawer } = useSectionNavigation();
  return (
    <button
      type="button"
      data-testid="trigger"
      onClick={(event) => openDrawer(event.currentTarget)}
    >
      open
    </button>
  );
}

function Page() {
  return (
    <SectionNavigationProvider chrome={siteNavChrome(LOCALE)} locale={LOCALE}>
      <Trigger />
      <SectionNavigation />
      <main id="main-content" tabIndex={-1}>
        {SECTION_REGISTRY.map(({ id }) => (
          <section key={id} id={id} tabIndex={-1} />
        ))}
      </main>
    </SectionNavigationProvider>
  );
}

const panel = () => document.getElementById(DRAWER_ID) as HTMLDialogElement;

function endSlide(
  property = 'transform',
  target: Element = panel(),
  elapsedTime = SLIDE_MS / MS_PER_SECOND,
) {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: property });
  Object.defineProperty(event, 'elapsedTime', { value: elapsedTime });
  act(() => {
    target.dispatchEvent(event);
  });
}

describe('the drawer exit slide', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installMatchMedia(false);
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    vi.stubGlobal('IntersectionObserver', undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function openSliding() {
    render(<Page />);
    panel().style.transitionDuration = `${SLIDE_MS}ms`;
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  }

  it('keeps the panel drawn while the slide-out runs, then closes the dialog on the transform end', () => {
    const trigger = openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel().classList.contains('is-open'), 'the slide-out starts at once').toBe(false);
    expect(panel().open).toBe(true);
    endSlide();
    expect(panel().open).toBe(false);
    expect(document.documentElement.hasAttribute(SCROLL_LOCK)).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('ignores the end of any other transition and of a child element', () => {
    openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    endSlide('opacity');
    endSlide('transform', panel().querySelector('.menu-close') as Element);
    expect(panel().open).toBe(true);
  });

  it('ignores a transform end that reports no elapsed time, which cut the slide short on Linux Chromium', () => {
    openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    endSlide('transform', panel(), 0);
    expect(panel().open, 'a zero-elapsed end is not the end of the slide').toBe(true);
    endSlide();
    expect(panel().open).toBe(false);
  });

  it('closes after the named duration when no transition end arrives', () => {
    vi.useFakeTimers();
    openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS - 1);
    });
    expect(panel().open).toBe(true);
    act(() => {
      vi.advanceTimersByTime(FALLBACK_SLACK_MS);
    });
    expect(panel().open).toBe(false);
  });

  it('closes on the fallback timer at the duration plus the slack when only a zero-elapsed end arrives', () => {
    vi.useFakeTimers();
    openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    endSlide('transform', panel(), 0);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS + EXIT_FALLBACK_SLACK_MS - ONE_MS);
    });
    expect(panel().open, 'the zero-elapsed end did not close it and the timer is not due').toBe(
      true,
    );
    act(() => {
      vi.advanceTimersByTime(ONE_MS);
    });
    expect(panel().open, 'the fallback timer closes it at the duration plus the slack').toBe(false);
    expect(panel().hasAttribute('data-exiting')).toBe(false);
  });

  it('closes at once when the stylesheet has no transition, as with MOTION off', () => {
    render(<Page />);
    panel().style.transitionDuration = '0s';
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel().open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('runs the same sequence for the cancel event, the close control and a backdrop click', () => {
    for (const close of [
      () => {
        const cancel = new Event('cancel', { cancelable: true });
        panel().dispatchEvent(cancel);
        expect(cancel.defaultPrevented).toBe(true);
      },
      () => fireEvent.click(screen.getByRole('button', { name: /close/i, hidden: true })),
      () => fireEvent.click(panel()),
    ]) {
      const trigger = openSliding();
      act(() => close());
      expect(panel().open, 'still sliding out').toBe(true);
      endSlide();
      expect(panel().open).toBe(false);
      expect(document.activeElement).toBe(trigger);
      document.body.replaceChildren();
    }
  });

  it('scrolls to a chosen section while the slide-out runs, not after it', () => {
    openSliding();
    fireEvent.click(screen.getAllByRole('link', { name: /projects/i, hidden: true })[0] as Element);
    expect(panel().open).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    endSlide();
    expect(panel().open).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('settles the closing drawer before it opens again', () => {
    const trigger = openSliding();
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(trigger);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(panel().open).toBe(true);
    expect(panel().classList.contains('is-open')).toBe(true);
    endSlide();
    expect(panel().open, 'the old slide-out cannot close the reopened drawer').toBe(true);
  });

  it('settles at once when the page unmounts during the slide-out', () => {
    vi.useFakeTimers();
    const view = render(<Page />);
    const dialog = panel();
    dialog.style.transitionDuration = `${SLIDE_MS}ms`;
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog.open).toBe(true);
    view.unmount();
    expect(dialog.open).toBe(false);
    expect(document.documentElement.hasAttribute(SCROLL_LOCK)).toBe(false);
  });
});
