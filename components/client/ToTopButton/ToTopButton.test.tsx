import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { SectionNavigationProvider } from '../../responsive/SectionNavigation';
import { ToTopButton } from './ToTopButton';

function renderButton(locale: SiteLocale) {
  return render(
    <SectionNavigationProvider chrome={siteNavChrome(locale)} locale={locale}>
      <ToTopButton />
    </SectionNavigationProvider>,
  );
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('ToTopButton', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  it('names the button with the locale copy', () => {
    renderButton(SITE_LOCALE.en);
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeDefined();
  });

  it('uses the pt-BR label on the pt locale', () => {
    renderButton(SITE_LOCALE.pt);
    expect(screen.getByRole('button', { name: 'Voltar ao topo' })).toBeDefined();
  });

  it('scrolls smoothly while motion is on', () => {
    localStorage.setItem('erik.motion', 'on');
    renderButton(SITE_LOCALE.en);
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('scrolls without animation when the visitor turned motion off', () => {
    localStorage.setItem('erik.motion', 'off');
    renderButton(SITE_LOCALE.en);
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('is inert while hidden, so Tab cannot land on an invisible control', () => {
    renderButton(SITE_LOCALE.en);
    const button = screen.getByRole('button', { name: 'Back to top' });
    expect(button.hasAttribute('inert'), 'a hidden to-top button must leave the tab order').toBe(
      true,
    );
    expect(button.classList.contains('to-top-show')).toBe(false);
  });

  it('stays hidden and inert when the page loads scrolled past the threshold', () => {
    scrollTo(500);
    renderButton(SITE_LOCALE.en);
    const button = screen.getByRole('button', { name: 'Back to top' });
    expect(button.classList.contains('to-top-show')).toBe(false);
    expect(button.hasAttribute('inert')).toBe(true);
  });

  it('stays hidden while the page scrolls down past the threshold', () => {
    scrollTo(0);
    renderButton(SITE_LOCALE.en);
    const button = screen.getByRole('button', { name: 'Back to top' });
    scrollTo(900);
    expect(button.classList.contains('to-top-show'), 'the tab covers text while reading').toBe(
      false,
    );
    expect(button.hasAttribute('inert')).toBe(true);
  });

  it('shows and leaves the tab order open on a scroll up, then hides on a scroll down', () => {
    scrollTo(0);
    renderButton(SITE_LOCALE.en);
    const button = screen.getByRole('button', { name: 'Back to top' });
    scrollTo(900);
    scrollTo(800);
    expect(button.classList.contains('to-top-show')).toBe(true);
    expect(button.hasAttribute('inert')).toBe(false);
    scrollTo(1000);
    expect(button.classList.contains('to-top-show')).toBe(false);
    expect(button.hasAttribute('inert')).toBe(true);
  });
});
