import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders value and label as dl/dt/dd', () => {
    render(<StatTile value="99%" label="uptime" />);
    const dl = screen.getByRole('definition').closest('dl');
    expect(dl).toBeDefined();
    expect(screen.getByText('99%').tagName).toBe('DD');
    expect(screen.getByText('uptime').tagName).toBe('DT');
  });
  it('applies compact class when variant=compact', () => {
    const { container } = render(<StatTile value="1" label="x" variant="compact" />);
    expect(container.firstElementChild?.classList.toString()).toContain('compact');
  });
});
