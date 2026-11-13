import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KeepTail } from './KeepTail';

describe('KeepTail', () => {
  it('keeps the text exactly as written for copy, search and screen readers', () => {
    const { container } = render(<KeepTail>PT-BR (native) · EN (C1) · FR (A2)</KeepTail>);
    expect(container.textContent).toBe('PT-BR (native) · EN (C1) · FR (A2)');
  });

  it('wraps only the last words in one unbreakable span', () => {
    const { container } = render(<KeepTail>PT-BR (native) · EN (C1) · FR (A2)</KeepTail>);
    const tails = container.querySelectorAll('.keep-together');
    expect(tails).toHaveLength(1);
    expect(tails[0]?.textContent).toBe('FR (A2)');
  });

  it('renders text with a long last word as plain text', () => {
    const { container } = render(<KeepTail>Write to erikhenriquealvescunha@gmail.com</KeepTail>);
    expect(container.querySelector('.keep-together')).toBeNull();
    expect(container.textContent).toBe('Write to erikhenriquealvescunha@gmail.com');
  });
});
