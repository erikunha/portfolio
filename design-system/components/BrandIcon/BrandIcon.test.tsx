import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandIcon } from './BrandIcon';

describe('BrandIcon', () => {
  it('is decorative: aria-hidden and not focusable', () => {
    const { container } = render(<BrandIcon />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });

  it('takes its colour from currentColor so a token can recolour it', () => {
    const { container } = render(<BrandIcon />);
    expect(container.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
  });

  it('crops the viewBox to the glasses so the mark fills its box', () => {
    const { container } = render(<BrandIcon />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 1433 4335 1300');
    expect(container.querySelectorAll('path').length).toBe(1);
  });

  it('sizes from the size prop and forwards className', () => {
    const { container } = render(<BrandIcon size={40} className="mine" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('40');
    expect(svg?.getAttribute('height')).toBe('12');
    expect(svg?.classList.contains('mine')).toBe(true);
  });

  it('carries no id, style or script that a second instance would collide with', () => {
    const { container } = render(
      <>
        <BrandIcon />
        <BrandIcon />
      </>,
    );
    expect(container.querySelectorAll('[id], style, script').length).toBe(0);
  });
});
