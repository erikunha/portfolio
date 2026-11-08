import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import { COPY_FEEDBACK_RESET_MS } from '@/lib/use-copy-feedback.client';
import { ContactLines } from './ContactLines';

const PAGE_URL = 'https://www.erikunha.dev/links';

describe('ContactLines', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is a labelled section with its own heading', () => {
    const { container } = render(<ContactLines locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    const section = container.querySelector('section[data-col="contact"]');
    expect(section).not.toBeNull();
    const heading = section?.querySelector('h2');
    expect(heading?.textContent).toBe('contato');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('leaves the mailto row untagged, because utm on a mailto is a broken address', () => {
    const { container } = render(<ContactLines locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    const email = container.querySelector('a[href^="mailto:"]');
    expect(email?.getAttribute('href')).toMatch(/^mailto:[^?]+$/);
  });

  it('does not announce a new tab for the mailto row, and does not open one', () => {
    const { container } = render(<ContactLines locale={LINKS_LOCALE.en} url={PAGE_URL} />);
    const email = container.querySelector('a[href^="mailto:"]');
    expect(email?.textContent).not.toMatch(/new tab/i);
    expect(email?.getAttribute('target')).toBeNull();
  });

  it('offers the copy-link control as the second row, showing the page address', () => {
    const { container } = render(<ContactLines locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    const rows = container.querySelectorAll('li > :is(a, button)');
    expect(rows).toHaveLength(2);
    expect(rows[1]?.tagName).toBe('BUTTON');
    expect(rows[1]?.querySelector('.links-line-host')?.textContent).toBe('erikunha.dev/links');
  });

  it.each([
    [LINKS_LOCALE.pt, 'copiado', 'Falha ao copiar'],
    [LINKS_LOCALE.en, 'copied', 'Copy failed'],
  ] as const)('words the copy outcome in the page language (%s)', async (locale, done, failed) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { container } = render(<ContactLines locale={locale} url={PAGE_URL} />);
    const button = container.querySelector('button') as HTMLButtonElement;
    const status = () => container.querySelector('[role="status"]')?.textContent ?? '';

    await act(async () => button.click());
    expect(status()).toContain(done);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(COPY_FEEDBACK_RESET_MS);
    });
    await act(async () => button.click());
    expect(status(), 'a failed copy says what to do next, in the page language').toContain(failed);
    expect(status()).toMatch(/endereço|address/);
  });
});
