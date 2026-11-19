import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { siteNavChrome } from '@/content/navigation';
import { SECTION_REGISTRY } from '@/content/section-registry';
import { SITE_LOCALE } from '@/content/site-locale';
import { isModalDialog } from '@/tests/mocks/dialog-shim';
import { DRAWER_ID } from './navigationIds';
import { SectionNavigation } from './SectionDrawer.client';
import {
  SectionNavigationProvider,
  useSectionNavigation,
} from './SectionNavigationProvider.client';

const LOCALE = SITE_LOCALE.en;
const SCROLL_LOCK = 'data-scroll-locked';
const SLIDE_MS = 200;
const CONTACT_SECTION_ID = 'sec-contact';

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

function endSlide() {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: 'transform' });
  act(() => {
    panel().dispatchEvent(event);
  });
}

describe('the drawer once it has been dismissed and is still sliding out', () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function openSliding() {
    render(<Page />);
    panel().style.transitionDuration = `${SLIDE_MS}ms`;
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    expect(isModalDialog(panel()), 'an open drawer is modal').toBe(true);
    return trigger;
  }

  it('is no longer modal, so the page takes input while the panel is still on screen', () => {
    openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel().open, 'the panel is still drawn').toBe(true);
    expect(isModalDialog(panel()), 'a modal dialog keeps the page inert for the whole slide').toBe(
      false,
    );
    expect(document.documentElement.hasAttribute(SCROLL_LOCK)).toBe(false);
  });

  it('has already returned focus to the trigger', () => {
    const trigger = openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });

  it('has already scrolled to the chosen section and focused it', () => {
    openSliding();
    fireEvent.click(screen.getAllByRole('link', { name: /contact/i, hidden: true })[0] as Element);
    expect(panel().open).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.getElementById(CONTACT_SECTION_ID));
    endSlide();
    expect(panel().open).toBe(false);
    expect(scrollIntoView, 'the end of the slide does not scroll again').toHaveBeenCalledTimes(1);
  });

  it('is modal again when it reopens before the slide ends', () => {
    const trigger = openSliding();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(trigger);
    expect(isModalDialog(panel())).toBe(true);
    expect(document.documentElement.hasAttribute(SCROLL_LOCK)).toBe(true);
    endSlide();
    expect(isModalDialog(panel()), 'the old slide cannot close the reopened drawer').toBe(true);
    expect(panel().open).toBe(true);
  });
});
