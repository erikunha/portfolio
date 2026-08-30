import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyLinkButton } from './CopyLinkButton.client';

const PAGE_URL = 'https://www.erikunha.dev/links';

function renderButton() {
  return render(<CopyLinkButton url={PAGE_URL} idleLabel="copiar link" doneLabel="copied ✓" />);
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

  it('returns to the idle label so a second copy is discoverable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    const { container } = renderButton();
    await click(container);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(statusText(container)).toBe('copiar link');
  });

  it('stays idle when the browser denies clipboard access', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container } = renderButton();
    await click(container);

    expect(statusText(container)).toBe('copiar link');
  });
});
