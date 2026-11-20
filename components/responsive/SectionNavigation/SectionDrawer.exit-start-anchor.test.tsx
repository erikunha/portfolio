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
const SLIDE_MS = 200;
const MS_PER_SECOND = 1000;
const EXIT_FALLBACK_SLACK_MS = 50;
const EXIT_START_CAP_MS = 1000;
const LATE_START_MS = 400;
const ELAPSED_AT_START_MS = 80;
const ONE_MS = 1;
const SLIDE_PROPERTY = 'transform';

type SlideStub = {
  transitionProperty: string;
  pending: boolean;
  startTime: number | null;
  currentTime: number | null;
  ready: Promise<unknown>;
};

type Slide = {
  stub: SlideStub;
  start: (elapsedMs?: number) => Promise<void>;
};

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

function pendingSlide(property = SLIDE_PROPERTY): Slide {
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const stub: SlideStub = {
    transitionProperty: property,
    pending: true,
    startTime: null,
    currentTime: null,
    ready,
  };
  return {
    stub,
    start: async (elapsedMs = 0) => {
      stub.pending = false;
      stub.startTime = 0;
      stub.currentTime = elapsedMs;
      await act(async () => {
        resolveReady();
        await ready;
      });
    },
  };
}

function endSlide() {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: SLIDE_PROPERTY });
  Object.defineProperty(event, 'elapsedTime', { value: SLIDE_MS / MS_PER_SECOND });
  act(() => {
    panel().dispatchEvent(event);
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('the drawer exit fallback is anchored to the start of the slide', () => {
  beforeEach(() => {
    installMatchMedia(false);
    Element.prototype.scrollIntoView =
      vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function exitWith(...slides: Slide[]) {
    render(<Page />);
    panel().style.transitionDuration = `${SLIDE_MS}ms`;
    panel().getAnimations = vi.fn(() => slides.map(({ stub }) => stub)) as never;
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
  }

  it('keeps the dialog open past the duration plus the slack while the slide has not started', () => {
    exitWith(pendingSlide());
    advance(SLIDE_MS + EXIT_FALLBACK_SLACK_MS + LATE_START_MS);
    expect(panel().open, 'a pending slide has not used any of its duration').toBe(true);
    expect(panel().hasAttribute('data-exiting')).toBe(true);
  });

  it('closes at the duration plus the slack after the slide starts, not after show()', async () => {
    const slide = pendingSlide();
    exitWith(slide);
    advance(LATE_START_MS);
    await slide.start();
    advance(SLIDE_MS + EXIT_FALLBACK_SLACK_MS - ONE_MS);
    expect(panel().open, 'the slide has run for less than its duration plus the slack').toBe(true);
    advance(ONE_MS);
    expect(panel().open).toBe(false);
    expect(panel().hasAttribute('data-exiting')).toBe(false);
  });

  it('counts only the time left when the slide starts already part way through', async () => {
    const slide = pendingSlide();
    exitWith(slide);
    await slide.start(ELAPSED_AT_START_MS);
    const left = SLIDE_MS - ELAPSED_AT_START_MS + EXIT_FALLBACK_SLACK_MS;
    advance(left - ONE_MS);
    expect(panel().open).toBe(true);
    advance(ONE_MS);
    expect(panel().open).toBe(false);
  });

  it('arms the duration plus the slack at once for a slide that already has a start time', () => {
    const slide = pendingSlide();
    slide.stub.pending = false;
    slide.stub.startTime = 0;
    slide.stub.currentTime = 0;
    exitWith(slide);
    advance(SLIDE_MS + EXIT_FALLBACK_SLACK_MS - ONE_MS);
    expect(panel().open).toBe(true);
    advance(ONE_MS);
    expect(panel().open).toBe(false);
  });

  it('still waits for a slide that is not pending but has no start time', () => {
    const slide = pendingSlide();
    slide.stub.pending = false;
    exitWith(slide);
    advance(SLIDE_MS + EXIT_FALLBACK_SLACK_MS + LATE_START_MS);
    expect(panel().open).toBe(true);
  });

  it('still waits for a slide that has a start time but is pending', () => {
    const slide = pendingSlide();
    slide.stub.startTime = 0;
    exitWith(slide);
    advance(SLIDE_MS + EXIT_FALLBACK_SLACK_MS + LATE_START_MS);
    expect(panel().open).toBe(true);
  });

  it('closes at the outer cap when the slide never starts', () => {
    exitWith(pendingSlide());
    advance(EXIT_START_CAP_MS - ONE_MS);
    expect(panel().open).toBe(true);
    advance(ONE_MS);
    expect(panel().open, 'a transition that never starts still closes the dialog').toBe(false);
  });

  it('closes at the outer cap when the slide starts and then never ends', async () => {
    const slide = pendingSlide();
    exitWith(slide);
    advance(EXIT_START_CAP_MS - SLIDE_MS);
    await slide.start();
    advance(SLIDE_MS - ONE_MS);
    expect(panel().open).toBe(true);
    advance(ONE_MS);
    expect(panel().open, 'start plus duration is past the cap, so the cap closes it').toBe(false);
  });

  it('closes on a real transform end while the slide is still pending', () => {
    exitWith(pendingSlide());
    endSlide();
    expect(panel().open).toBe(false);
  });

  it('does not close a reopened drawer when the old slide starts after it was settled', async () => {
    const slide = pendingSlide();
    exitWith(slide);
    endSlide();
    fireEvent.click(screen.getByTestId('trigger'));
    expect(panel().open).toBe(true);
    await slide.start();
    advance(EXIT_START_CAP_MS);
    expect(panel().open, 'the settled exit must not arm a timer for the new open').toBe(true);
  });

  it('does not close a reopened drawer when the old slide had started and then ended', async () => {
    const slide = pendingSlide();
    exitWith(slide);
    await slide.start();
    endSlide();
    fireEvent.click(screen.getByTestId('trigger'));
    expect(panel().open).toBe(true);
    advance(EXIT_START_CAP_MS);
    expect(panel().open, 'neither the start timer nor the cap outlives the exit').toBe(true);
  });

  it('closes at the outer cap when the slide is cancelled before it starts', async () => {
    const slide = pendingSlide();
    slide.stub.ready = Promise.reject(new Error('cancelled'));
    exitWith(slide);
    await act(async () => undefined);
    advance(EXIT_START_CAP_MS - ONE_MS);
    expect(panel().open).toBe(true);
    advance(ONE_MS);
    expect(panel().open).toBe(false);
  });

  it('uses the named duration plus the slack when the transition is not on transform', () => {
    exitWith(pendingSlide('opacity'));
    advance(SLIDE_MS + EXIT_FALLBACK_SLACK_MS - ONE_MS);
    expect(panel().open).toBe(true);
    advance(ONE_MS);
    expect(panel().open).toBe(false);
  });

  it('uses the named duration plus the slack when the animation is not a transition', () => {
    const slide = pendingSlide();
    delete (slide.stub as Partial<SlideStub>).transitionProperty;
    exitWith(slide);
    advance(SLIDE_MS + EXIT_FALLBACK_SLACK_MS);
    expect(panel().open).toBe(false);
  });

  it('closes at once when the stylesheet has no transition, as with MOTION off', () => {
    render(<Page />);
    panel().style.transitionDuration = '0s';
    panel().getAnimations = vi.fn(() => [pendingSlide().stub]) as never;
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel().open).toBe(false);
  });
});
