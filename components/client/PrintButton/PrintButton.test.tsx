import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readingViews } from '@/content/reading-views';
import { SITE_LOCALE } from '@/content/site-locale';
import { PrintButton } from './PrintButton.client';

describe('PrintButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a real button named by the label it is given', () => {
    render(<PrintButton label={readingViews[SITE_LOCALE.en].shared.printLabel} />);
    const button = screen.getByRole('button', {
      name: readingViews[SITE_LOCALE.en].shared.printLabel,
    });
    expect(button.getAttribute('type')).toBe('button');
  });

  it('opens the print dialog once per activation', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<PrintButton label={readingViews[SITE_LOCALE.en].shared.printLabel} />);
    fireEvent.click(
      screen.getByRole('button', { name: readingViews[SITE_LOCALE.en].shared.printLabel }),
    );
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('is the design-system button at its medium size, which holds the touch target', () => {
    render(<PrintButton label={readingViews[SITE_LOCALE.en].shared.printLabel} />);
    const button = screen.getByRole('button');
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.getAttribute('data-variant')).toBe('secondary');
    expect(button.getAttribute('data-size')).toBe('md');
  });
});
