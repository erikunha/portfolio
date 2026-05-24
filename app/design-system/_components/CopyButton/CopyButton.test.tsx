import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton.client';

describe('CopyButton', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows COPIED after click when clipboard succeeds', async () => {
    render(<CopyButton text="npm install react" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'COPY' }));
    });
    expect(screen.getByRole('button', { name: 'COPIED' })).toBeDefined();
    expect(writeText).toHaveBeenCalledWith('npm install react');
  });

  it('resets to COPY after 1500ms', async () => {
    render(<CopyButton text="npm install react" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'COPY' }));
    });
    expect(screen.getByRole('button', { name: 'COPIED' })).toBeDefined();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('button', { name: 'COPY' })).toBeDefined();
  });

  it('stays COPY when clipboard throws DOMException', async () => {
    writeText.mockRejectedValue(new DOMException('Permission denied'));
    render(<CopyButton text="npm install react" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'COPY' }));
    });
    expect(screen.getByRole('button', { name: 'COPY' })).toBeDefined();
  });

  it('passes the correct text to clipboard.writeText', async () => {
    const tokenValue = '--ds-color-signal: #00FF41;';
    render(<CopyButton text={tokenValue} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'COPY' }));
    });
    expect(writeText).toHaveBeenCalledWith(tokenValue);
  });
});
