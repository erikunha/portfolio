import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { footerContent } from '@/content/footer';
import { SITE_LOCALE } from '@/content/site-locale';
import { addRef, clearRefs, removeRef } from '@/lib/request-refs.client';
import { Footer } from './index';

const A = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const B = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const copy = footerContent[SITE_LOCALE.en].receipt;

describe('footer session receipt', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearRefs();
  });
  afterEach(() => {
    cleanup();
    clearRefs();
    vi.unstubAllGlobals();
  });

  it('shows nothing before any request', () => {
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    expect(container.querySelector('[data-testid="footer-receipt"]')).toBeNull();
    expect(container.textContent).not.toContain(copy.label);
  });

  it('shows the last request id after an ask or contact request, and follows the newest', () => {
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    act(() => addRef(A));
    const receipt = container.querySelector('[data-testid="footer-receipt"]');
    expect(receipt?.textContent).toContain(`${copy.label} ${A}`);
    act(() => addRef(B));
    expect(receipt?.textContent).toContain(B);
    expect(receipt?.textContent).not.toContain(A);
  });

  it('reads the receipt of a request made before this page mounted', () => {
    addRef(A);
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    expect(container.querySelector('[data-testid="footer-receipt"]')?.textContent).toContain(A);
  });

  it('goes back to the previous id, then to nothing, as requests are forgotten', () => {
    addRef(A);
    addRef(B);
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    act(() => removeRef(B));
    expect(container.querySelector('[data-testid="footer-receipt"]')?.textContent).toContain(A);
    act(() => removeRef(A));
    expect(container.querySelector('[data-testid="footer-receipt"]')).toBeNull();
  });

  it('copies the full id and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    addRef(A);
    render(<Footer locale={SITE_LOCALE.en} />);
    await act(async () => {
      screen.getByRole('button', { name: new RegExp(copy.feedback.idle.label, 'i') }).click();
    });
    expect(writeText).toHaveBeenCalledExactlyOnceWith(A);
    const status = screen
      .getAllByRole('status')
      .find((node) => node.textContent === copy.feedback.success.message);
    expect(status).toBeDefined();
  });

  it('does not render a receipt on the server, so hydration cannot mismatch', async () => {
    addRef(A);
    const { renderToStaticMarkup } = await import('react-dom/server');
    expect(renderToStaticMarkup(<Footer locale={SITE_LOCALE.en} />)).not.toContain(A);
  });

  it('has a Portuguese label', () => {
    expect(footerContent[SITE_LOCALE.pt].receipt.label).not.toBe(copy.label);
  });
});
