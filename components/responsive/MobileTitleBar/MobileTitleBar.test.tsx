import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION } from '@/content/navigation';
import { topbarChrome } from '@/content/terminal-chrome';
import { DRAWER_ID, SectionNavigationProvider } from '../SectionNavigation';
import { MobileTitleBar } from './MobileTitleBar.client';

const BAR_CLASS = 'mobile-title-bar';
const RIGHT_ALIGNED_CLASS = 'ml-auto';
const HIDDEN_BELOW_360_CLASS = 'min-[360px]:flex';

function bar(): Element {
  const element = document.querySelector(`.${BAR_CLASS}`);
  expect(element, `the bar renders with the ${BAR_CLASS} class`).not.toBeNull();
  return element as Element;
}

describe('MobileTitleBar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    Element.prototype.scrollIntoView =
      vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  it('renders the dots first and the INDEX and brand group on the right', () => {
    render(
      <SectionNavigationProvider>
        <MobileTitleBar />
      </SectionNavigationProvider>,
    );

    const root = bar();
    expect(root.childElementCount, 'the bar renders exactly two children').toBe(2);

    const dotsWrapper = root.firstElementChild;
    const group = dotsWrapper?.nextElementSibling;

    expect(
      dotsWrapper?.classList.contains('hidden'),
      'the dots are hidden below 360px by the hidden class',
    ).toBe(true);
    expect(
      dotsWrapper?.classList.contains(HIDDEN_BELOW_360_CLASS),
      'the dots show again from 360px up through the min-[360px]:flex class',
    ).toBe(true);
    expect(
      dotsWrapper?.querySelector('.window-chrome'),
      'the dots wrapper holds the window chrome dots',
    ).not.toBeNull();
    expect(
      group?.classList.contains(RIGHT_ALIGNED_CLASS),
      'the INDEX and brand group is pushed to the right edge by ml-auto',
    ).toBe(true);
    expect(group?.childElementCount, 'the group holds the trigger and the brand').toBe(2);

    const trigger = group?.firstElementChild;
    const brand = trigger?.nextElementSibling;

    expect(trigger?.textContent, 'the trigger label comes from content').toContain(
      NAVIGATION.copy.indexLabel,
    );
    expect(brand?.textContent, 'the brand label comes from content').toBe(
      topbarChrome.brandLabel,
    );
    expect(brand?.getAttribute('aria-hidden'), 'the brand stays decoration').toBe('true');
  });

  it('keeps the INDEX trigger a dialog trigger pointing at the section drawer', () => {
    render(
      <SectionNavigationProvider>
        <MobileTitleBar />
      </SectionNavigationProvider>,
    );

    const trigger = screen.getByRole('button', { name: new RegExp(NAVIGATION.copy.indexLabel) });
    expect(trigger.getAttribute('aria-haspopup'), 'aria-haspopup is dialog').toBe('dialog');
    expect(trigger.getAttribute('aria-controls'), 'aria-controls targets drawer').toBe(DRAWER_ID);
    expect(trigger.getAttribute('aria-expanded'), 'aria-expanded is false').toBe('false');
  });
});
