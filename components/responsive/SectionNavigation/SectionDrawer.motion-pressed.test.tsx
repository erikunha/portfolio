import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { TOPBAR_MOTION_LABEL } from '@/content/nav';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { SectionNavigation, SectionNavigationProvider } from './index';

const MOTION_STORAGE_KEY = 'erik.motion';
const MOTION_ROW = '.menu-motion';
const MOTION_STATE = '[data-motion-state]';
const MOTION_REDUCED = 'reduce';

class FakeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
}

describe.each(Object.values(SITE_LOCALE))('the drawer MOTION toggle (%s)', (locale) => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    installMatchMedia(() => false);
    delete document.body.dataset.motion;
    localStorage.removeItem(MOTION_STORAGE_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.body.dataset.motion;
    localStorage.removeItem(MOTION_STORAGE_KEY);
  });

  function mountToggle(): HTMLButtonElement {
    render(
      <SectionNavigationProvider chrome={siteNavChrome(locale)} locale={locale}>
        <SectionNavigation />
      </SectionNavigationProvider>,
    );
    return document.querySelector(MOTION_ROW) as HTMLButtonElement;
  }

  it('carries its state in aria-pressed alone and follows every press, off then on again', () => {
    const toggle = mountToggle();
    const copy = NAVIGATION[locale].copy;
    const state = toggle.querySelector(MOTION_STATE) as HTMLElement;

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(
      state.closest('[aria-hidden="true"]'),
      'the visible state word is hidden from AT',
    ).not.toBe(null);
    expect(toggle.hasAttribute('aria-label')).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(state.textContent).toBe(copy.motionOff);
    expect(document.body.dataset.motion).toBe(MOTION_REDUCED);
    expect(screen.getByRole('button', { name: TOPBAR_MOTION_LABEL, pressed: false })).toBe(toggle);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(state.textContent).toBe(copy.motionOn);
    expect(document.body.dataset.motion).not.toBe(MOTION_REDUCED);
    expect(screen.getByRole('button', { name: TOPBAR_MOTION_LABEL, pressed: true })).toBe(toggle);
  });
});
