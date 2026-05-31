import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders value and label as dl/dt/dd with dt before dd in DOM', () => {
    render(<StatTile value="99%" label="uptime" />);
    const dl = screen.getByRole('definition').closest('dl');
    expect(dl).not.toBeNull();
    expect(screen.getByText('uptime').tagName).toBe('DT');
    expect(screen.getByText('99%').tagName).toBe('DD');
    const children = Array.from(dl?.children ?? []);
    expect(children[0]?.tagName).toBe('DT');
    expect(children[1]?.tagName).toBe('DD');
  });
  it('applies compact font size override when variant=compact', () => {
    const { container } = render(<StatTile value="1" label="x" variant="compact" />);
    const dd = container.querySelector('dd');
    // compact overrides the default text-2xl down to text-xs (twMerge removes the base class)
    expect(dd?.classList.contains('text-xs')).toBe(true);
    expect(dd?.classList.contains('text-2xl')).toBe(false);
  });
  it('does not apply an undefined default class when variant=default', () => {
    const { container } = render(<StatTile value="1" label="x" />);
    const classList = container.firstElementChild?.classList.toString() ?? '';
    expect(classList).not.toContain('undefined');
    expect(classList).not.toContain('default');
  });
});
