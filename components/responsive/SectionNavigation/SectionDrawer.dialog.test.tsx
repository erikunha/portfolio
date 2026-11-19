import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
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

describe('the section drawer as a modal dialog', () => {
  beforeEach(() => {
    installMatchMedia(false);
    Element.prototype.scrollIntoView =
      vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    vi.stubGlobal('IntersectionObserver', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete document.body.dataset.motion;
  });

  function open() {
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  }

  it('renders the panel as a closed dialog labelled from the navigation copy', () => {
    render(<Page />);
    expect(panel().tagName).toBe('DIALOG');
    expect(panel().open).toBe(false);
    expect(panel().getAttribute('aria-label')).toBe(NAVIGATION[LOCALE].copy.drawerLabel);
  });

  it('opens through showModal and leaves modality to the platform', () => {
    render(<Page />);
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    open();
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(panel().open).toBe(true);
    expect(panel().hasAttribute('role'), 'a dialog element carries its role').toBe(false);
    expect(panel().hasAttribute('aria-modal'), 'showModal carries the modality').toBe(false);
    expect(
      document.querySelectorAll('[inert]'),
      'showModal makes the rest inert itself',
    ).toHaveLength(0);
  });

  it('focuses the destination marked current when it opens', () => {
    render(<Page />);
    open();
    expect(document.activeElement?.getAttribute('aria-current')).toBeTruthy();
    expect(panel().contains(document.activeElement)).toBe(true);
  });

  it('answers the cancel request by closing through state, so the exit slide can run', () => {
    render(<Page />);
    const trigger = open();
    const cancel = new Event('cancel', { cancelable: true });
    act(() => {
      panel().dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(panel().open).toBe(false);
    expect(panel().classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<Page />);
    const trigger = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel().open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the dialog itself is clicked, which is where a backdrop click lands', () => {
    render(<Page />);
    const trigger = open();
    fireEvent.click(
      screen.getByRole('button', { name: NAVIGATION[LOCALE].copy.closeDrawer })
        .parentElement as HTMLElement,
    );
    expect(panel().open, 'a click inside the panel keeps it open').toBe(true);
    fireEvent.click(panel());
    expect(panel().open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('follows a native close, such as a second Escape the platform will not let a page cancel', async () => {
    render(<Page />);
    const trigger = open();
    await act(async () => {
      panel().close();
    });
    expect(panel().classList.contains('is-open')).toBe(false);
    expect(document.documentElement.hasAttribute(SCROLL_LOCK)).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the dialog and frees scrolling when the page unmounts while it is open', () => {
    const view = render(<Page />);
    open();
    const dialog = panel();
    view.unmount();
    expect(dialog.open).toBe(false);
    expect(document.documentElement.hasAttribute(SCROLL_LOCK)).toBe(false);
  });
});
