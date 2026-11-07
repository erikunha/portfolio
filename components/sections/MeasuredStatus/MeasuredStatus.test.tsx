import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MeasuredStatus } from './MeasuredStatus';

const RESERVE = ['loading…', 'Eval pending. No results are available yet.', 'unavailable'];

describe('MeasuredStatus', () => {
  it('reserves the room of the longest message whichever message is shown', () => {
    const { container, rerender } = render(
      <MeasuredStatus message="loading…" live reserve={RESERVE} />,
    );
    const slot = container.querySelector('.measured-status-slot');
    expect(slot?.getAttribute('data-reserve')).toBe(RESERVE[1]);

    rerender(<MeasuredStatus message={null} live reserve={RESERVE} />);
    expect(container.querySelector('.measured-status-slot')?.getAttribute('data-reserve')).toBe(
      RESERVE[1],
    );
    expect(container.querySelector('.measured-status')).toBeNull();
  });

  it('announces a live message through a polite status role and leaves a silent one plain', () => {
    const { container, rerender } = render(
      <MeasuredStatus message="loading…" live reserve={RESERVE} />,
    );
    expect(container.querySelector('p')?.getAttribute('role')).toBe('status');

    rerender(<MeasuredStatus message="timestamp unavailable" live={false} reserve={RESERVE} />);
    expect(container.querySelector('p')?.hasAttribute('role')).toBe(false);
  });
});
