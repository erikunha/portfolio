import { act, cleanup, render } from '@testing-library/react';
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

  it('shows a recorded-request status, without the request id, after a request is made', () => {
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    act(() => addRef(A));
    const receipt = container.querySelector('[data-testid="footer-receipt"]');
    expect(receipt?.textContent).toContain(copy.label);
    expect(receipt?.textContent).not.toContain(A);
    act(() => addRef(B));
    expect(receipt?.textContent).not.toContain(A);
    expect(receipt?.textContent).not.toContain(B);
  });

  it('reads the receipt of a request made before this page mounted', () => {
    addRef(A);
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    const receipt = container.querySelector('[data-testid="footer-receipt"]');
    expect(receipt?.textContent).toContain(copy.label);
    expect(receipt?.textContent).not.toContain(A);
  });

  it('stays while a request is remembered, then goes away when the last one is forgotten', () => {
    addRef(A);
    addRef(B);
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    act(() => removeRef(B));
    expect(container.querySelector('[data-testid="footer-receipt"]')).not.toBeNull();
    act(() => removeRef(A));
    expect(container.querySelector('[data-testid="footer-receipt"]')).toBeNull();
  });

  it('renders no request id and no copy control', () => {
    addRef(A);
    const { container } = render(<Footer locale={SITE_LOCALE.en} />);
    const receipt = container.querySelector('[data-testid="footer-receipt"]');
    expect(receipt?.querySelector('code')).toBeNull();
    expect(receipt?.querySelector('button')).toBeNull();
    expect(container.textContent).not.toContain(A);
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
