import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyLinkButton } from './CopyLinkButton.client';

const PAGE_URL = 'https://www.erikunha.dev/links';

function renderButton() {
  return render(
    <CopyLinkButton
      url={PAGE_URL}
      hostLabel="erikunha.dev/links"
      idleLabel="copiar link"
      doneLabel="copied ✓"
      failedLabel="copy failed"
      failedMessage="Copy failed. Copy the address from the browser bar."
    />,
  );
}

async function click(container: HTMLElement) {
  const button = container.querySelector('button');
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function statusText(container: HTMLElement): string {
  return container.querySelector('[role="status"]')?.textContent ?? '';
}

describe('CopyLinkButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('wears the shared line classes and keeps its status region outside the button', () => {
    const { container } = renderButton();
    const button = container.querySelector('button');
    expect(button?.classList.contains('links-line')).toBe(true);
    expect(button?.querySelector('.links-line-glyph')).not.toBeNull();
    expect(button?.querySelector('.links-line-host')?.textContent).toBe('erikunha.dev/links');
    expect(button?.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('writes the page url to the clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container } = renderButton();
    await click(container);

    expect(writeText).toHaveBeenCalledWith(PAGE_URL);
  });

  it('announces the copy through a status region, not colour alone', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    const { container } = renderButton();
    expect(statusText(container)).toBe('copiar link');

    await click(container);
    expect(statusText(container)).toBe('copied ✓');
  });

  it('keeps the status region outside the button and gives the button a stable name', () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    const { container } = renderButton();
    const button = container.querySelector('button');
    expect(button?.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('copiar link');
  });

  it('returns to the idle label so a second copy is discoverable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    const { container } = renderButton();
    await click(container);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(statusText(container)).toBe('copiar link');
  });

  it.each([
    ['idle', 'copiar link'],
    ['copied', '$ copied ✓'],
  ])('shows one visible label at a time (%s)', async (state, expected) => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    const { container } = renderButton();
    if (state === 'copied') await click(container);
    const label = container.querySelector('button .links-line-label');
    expect(label?.textContent).toBe(expected);
  });

  it('reports a denied clipboard instead of failing silently, then recovers', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container } = renderButton();
    await click(container);
    expect(statusText(container)).toBe('Copy failed. Copy the address from the browser bar.');
    expect(container.querySelector('button .links-line-label')?.textContent).toBe('$ copy failed');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(statusText(container)).toBe('copiar link');
  });
  it('reports a missing clipboard API (insecure context) as a failed copy', async () => {
    vi.stubGlobal('navigator', {});

    const { container } = renderButton();
    await click(container);
    expect(statusText(container)).toBe('Copy failed. Copy the address from the browser bar.');
  });
});
