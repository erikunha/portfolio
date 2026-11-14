import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BREAK_AFTER, BreakAfter } from './BreakAfter';

describe('BreakAfter inside a flex parent', () => {
  it('renders one inline element, so a flex link keeps its text and break hints in one item', () => {
    const { container } = render(
      <a href="mailto:someone@example.com" style={{ display: 'inline-flex' }}>
        <BreakAfter chars={BREAK_AFTER.email}>someone@example.com</BreakAfter>
      </a>,
    );
    const link = container.querySelector('a');
    expect(link?.childNodes).toHaveLength(1);
    expect(link?.firstElementChild?.tagName).toBe('SPAN');
    expect(link?.textContent).toBe('someone@example.com');
    expect(link?.querySelectorAll('wbr')).toHaveLength(1);
  });
});
