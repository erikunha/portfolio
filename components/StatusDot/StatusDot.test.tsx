import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusDot } from './StatusDot';

describe('StatusDot', () => {
  it('renders one decorative dot with the shared class', () => {
    const { container } = render(<StatusDot />);
    const dot = container.firstElementChild;

    expect(dot?.tagName).toBe('SPAN');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.classList.contains('status-dot')).toBe(true);
    expect(dot?.classList.contains('status-dot-blink')).toBe(false);
  });

  it('blinks only when asked', () => {
    const { container } = render(<StatusDot blink />);

    expect(container.firstElementChild?.classList.contains('status-dot-blink')).toBe(true);
  });

  it('passes a consumer class through without dropping its own', () => {
    const { container } = render(<StatusDot className="ctz-dot" />);
    const classes = container.firstElementChild?.classList;

    expect(classes?.contains('status-dot')).toBe(true);
    expect(classes?.contains('ctz-dot')).toBe(true);
  });

  it('can render twice without clashing ids', () => {
    const { container } = render(
      <>
        <StatusDot />
        <StatusDot />
      </>,
    );

    expect(container.querySelectorAll('[id]')).toHaveLength(0);
  });
});
