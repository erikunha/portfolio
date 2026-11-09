import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton.client';

describe('CopyButton', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function copy(name = 'COPY') {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name }));
    });
  }

  it('mounts an empty live region before copying and announces success', async () => {
    render(<CopyButton text="npm install react" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    await copy();
    expect(screen.getByRole('button', { name: 'COPIED' })).toBeDefined();
    expect(status.textContent).toBe('Copied to clipboard.');
    expect(writeText).toHaveBeenCalledWith('npm install react');
  });

  it('resets success after 1500ms', async () => {
    render(<CopyButton text="npm install react" />);
    await copy();
    await act(async () => vi.advanceTimersByTime(1500));
    expect(screen.getByRole('button', { name: 'COPY' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it.each([new DOMException('Permission denied'), new Error('Write failed')])(
    'announces a rejected clipboard write and allows retry: %s',
    async (error) => {
      writeText.mockRejectedValueOnce(error);
      render(<CopyButton text="npm install react" />);
      await copy();
      expect(screen.getByRole('button', { name: 'COPY FAILED' })).toBeDefined();
      expect(screen.getByRole('status').textContent).toBe(
        'Copy failed. Select and copy the text manually.',
      );
      await copy('COPY FAILED');
      expect(screen.getByRole('button', { name: 'COPIED' })).toBeDefined();
      expect(screen.getByRole('status').textContent).toBe('Copied to clipboard.');
    },
  );

  it.each([undefined, {}])('announces unavailable clipboard access: %s', async (clipboard) => {
    vi.stubGlobal('navigator', { clipboard });
    render(<CopyButton text="npm install react" />);
    await copy();
    expect(screen.getByRole('button', { name: 'COPY UNAVAILABLE' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe(
      'Clipboard unavailable. Select and copy the text manually.',
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it('updates the live region when clipboard access remains unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined });
    render(<CopyButton text="sample" />);
    const status = screen.getByRole('status');
    await copy();
    const firstAnnouncement = status.firstChild;
    await copy('COPY UNAVAILABLE');
    expect(status.textContent).toBe('Clipboard unavailable. Select and copy the text manually.');
    expect(status.firstChild).not.toBe(firstAnnouncement);
  });

  it('does not let an earlier success timer erase a later failure', async () => {
    render(<CopyButton text="npm install react" />);
    await copy();
    writeText.mockRejectedValueOnce(new Error('Write failed'));
    await copy('COPIED');
    await act(async () => vi.advanceTimersByTime(1500));
    expect(screen.getByRole('button', { name: 'COPY FAILED' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('Copy failed.');
  });

  it('ignores overlapping writes and clears feedback while retrying', async () => {
    render(<CopyButton text="npm install react" />);
    await copy();
    let finish: (() => void) | undefined;
    writeText.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await copy('COPIED');
    expect(screen.getByRole('status').textContent).toBe('');
    await copy();
    expect(writeText).toHaveBeenCalledTimes(2);
    await act(async () => finish?.());
    expect(screen.getByRole('status').textContent).toBe('Copied to clipboard.');
  });

  it('keeps each instance feedback independent', async () => {
    render(
      <>
        <CopyButton text="first" />
        <CopyButton text="second" />
      </>,
    );
    await act(async () =>
      fireEvent.click(screen.getAllByRole('button', { name: 'COPY' })[0] as HTMLElement),
    );
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual([
      'Copied to clipboard.',
      '',
    ]);
  });

  it('preserves consumer attributes and click cancellation', async () => {
    const onClick = vi.fn((event) => event.preventDefault());
    render(
      <CopyButton
        text="sample"
        id="copy-sample"
        className="consumer"
        aria-label="Copy sample"
        aria-describedby="sample"
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Copy sample' });
    expect(button.id).toBe('copy-sample');
    expect(button.classList.contains('consumer')).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('sample');
    await copy('Copy sample');
    expect(onClick).toHaveBeenCalledOnce();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('honors consumer disabled state', async () => {
    render(<CopyButton text="sample" disabled />);
    await copy();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('cleans up its feedback timer when unmounted', async () => {
    const { unmount } = render(<CopyButton text="sample" />);
    await copy();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not create a feedback timer if a pending write finishes after unmount', async () => {
    let finish: (() => void) | undefined;
    writeText.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount } = render(<CopyButton text="sample" />);
    await copy();
    unmount();
    await act(async () => finish?.());
    expect(vi.getTimerCount()).toBe(0);
  });
});
