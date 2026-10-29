import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readingViews } from '@/content/reading-views';
import { PrintButton } from './PrintButton.client';

describe('PrintButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a real button named by the label it is given', () => {
    render(<PrintButton label={readingViews.shared.printLabel} />);
    const button = screen.getByRole('button', { name: readingViews.shared.printLabel });
    expect(button.getAttribute('type')).toBe('button');
  });

  it('opens the print dialog once per activation', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<PrintButton label={readingViews.shared.printLabel} />);
    fireEvent.click(screen.getByRole('button', { name: readingViews.shared.printLabel }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('keeps the minimum touch target of the design-system button', () => {
    render(<PrintButton label={readingViews.shared.printLabel} />);
    const classes = screen.getByRole('button').className;
    expect(classes).toContain('min-h-11');
    expect(classes).toContain('focus-visible:outline-2');
  });
});
