import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAnnouncer } from './use-announcer.client';

let announceRef: (text: string) => void = () => undefined;

function Harness({ attributes }: { attributes?: Record<string, string> }) {
  const { announce, region } = useAnnouncer(attributes);
  announceRef = announce;
  return <div>{region}</div>;
}

describe('useAnnouncer', () => {
  it('renders an empty sr-only status region before any announcement', () => {
    render(<Harness />);
    const region = screen.getByRole('status');
    expect(region.tagName).toBe('P');
    expect(region.className).toBe('sr-only');
    expect(region.textContent).toBe('');
  });

  it('shows the announced text in the region', () => {
    render(<Harness />);
    act(() => announceRef('Saved'));
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('replaces the span when identical text is announced again', () => {
    render(<Harness />);
    act(() => announceRef('Saved'));
    const first = screen.getByText('Saved');
    act(() => announceRef('Saved'));
    const second = screen.getByText('Saved');
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
  });

  it('passes extra attributes through to the region', () => {
    render(
      <Harness attributes={{ 'aria-live': 'polite', 'aria-atomic': 'true', 'data-testid': 'x' }} />,
    );
    const region = screen.getByTestId('x');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.getAttribute('role')).toBe('status');
  });
});
