import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { serverErrorContent } from '@/content/server-error-detail';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const { ServerErrorMain } = await import('./ErrorPages.client');
const { GlobalErrorPage } = await import('./GlobalErrorPage.client');

const STAMPS = { rendered: '0.100', reported: '0.200' };
const LEGACY_CLASS = 'err-action';

describe('error page actions', () => {
  it('renders the retry and home actions on the shared base with their variants', () => {
    const content = serverErrorContent[SITE_LOCALE.en];
    render(<ServerErrorMain retry={vi.fn()} content={content} stamps={STAMPS} />);
    const retry = screen.getByRole('button', { name: content.retryLabel });
    const home = screen.getByRole('link', { name: content.home.label });
    expect(retry.classList.contains('btn')).toBe(true);
    expect(retry.getAttribute('data-variant')).toBe('primary');
    expect(home.classList.contains('btn')).toBe(true);
    expect(home.getAttribute('data-variant')).toBe('secondary');
    expect(retry.className).not.toContain(LEGACY_CLASS);
    expect(home.className).not.toContain(LEGACY_CLASS);
  });

  it('keeps raw markup with the base class in the global error document', () => {
    const html = renderToStaticMarkup(<GlobalErrorPage error={new Error('x')} retry={vi.fn()} />);
    const document = new DOMParser().parseFromString(html, 'text/html');
    const content = serverErrorContent[SITE_LOCALE.en];
    const retry = document.querySelector('.err-actions button');
    const home = document.querySelector('.err-actions a');
    expect(retry?.getAttribute('class')).toBe('btn');
    expect(retry?.getAttribute('data-variant')).toBe('primary');
    expect(retry?.textContent).toBe(content.retryLabel);
    expect(home?.getAttribute('class')).toBe('btn');
    expect(home?.getAttribute('data-variant')).toBe('secondary');
  });
});
