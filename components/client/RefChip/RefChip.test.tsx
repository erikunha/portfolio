import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFeedback } from '@/content/copy-button';
import { SITE_LOCALE } from '@/content/site-locale';
import { REF_COPY_RESET_MS, RefChip } from './RefChip.client';

const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const feedback = copyFeedback[SITE_LOCALE.en];

function renderChip(props: Partial<React.ComponentProps<typeof RefChip>> = {}) {
  return render(<RefChip value={REF} prefix="ref" feedback={feedback} {...props} />);
}

async function click(name: RegExp | string) {
  await act(async () => {
    screen.getByRole('button', { name }).click();
  });
}

describe('RefChip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the prefix and the full id, and exposes the id as its title', () => {
    const { container } = renderChip();
    const id = container.querySelector('code');
    expect(id?.textContent).toBe(REF);
    expect(id?.getAttribute('title')).toBe(REF);
    expect(container.textContent).toContain('ref');
  });

  it('copies the full id and announces success, then reverts after the reset window', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderChip();
    await click(/copy/i);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(REF);
    expect(screen.getByRole('button').textContent).toBe(feedback.success.label);
    expect(screen.getByRole('status').textContent).toBe(feedback.success.message);
    await act(async () => {
      vi.advanceTimersByTime(REF_COPY_RESET_MS - 1);
    });
    expect(screen.getByRole('button').textContent).toBe(feedback.success.label);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('button').textContent).toBe(feedback.idle.label);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('announces a failure when the clipboard rejects, and keeps the id selectable', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const { container } = renderChip();
    await click(/copy/i);
    expect(screen.getByRole('status').textContent).toBe(feedback.failure.message);
    expect(screen.getByRole('button').textContent).toBe(feedback.failure.label);
    expect(container.querySelector('code')?.textContent).toBe(REF);
  });

  it('announces unavailable when there is no clipboard API', async () => {
    vi.stubGlobal('navigator', {});
    renderChip();
    await click(/copy/i);
    expect(screen.getByRole('status').textContent).toBe(feedback.unavailable.message);
  });

  it('uses caller labels for the idle and copied states', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    renderChip({ labels: { copy: '[COPY REF]', copied: '[REF COPIED]' } });
    expect(screen.getByRole('button').textContent).toBe('[COPY REF]');
    await click('[COPY REF]');
    expect(screen.getByRole('button').textContent).toBe('[REF COPIED]');
  });

  it('passes id, aria-* and className to the root without overriding its own class', () => {
    const { container } = renderChip({
      id: 'custom-chip',
      className: 'extra',
      'aria-label': 'request reference',
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.id).toBe('custom-chip');
    expect(root.getAttribute('aria-label')).toBe('request reference');
    expect(root.classList.contains('extra')).toBe(true);
    expect(root.classList.contains('ref-chip')).toBe(true);
  });

  it('can render twice on a page without a duplicate id attribute', () => {
    const { container } = render(
      <>
        <RefChip value={REF} prefix="ref" feedback={feedback} />
        <RefChip value={REF} prefix="ref" feedback={feedback} />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders the copy control as a focusable button that does not submit a form', () => {
    renderChip();
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.disabled).toBe(false);
  });
});
