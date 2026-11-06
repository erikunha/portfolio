import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorsClientContent } from '@/content/errors-client';
import { SITE_LOCALE } from '@/content/site-locale';
import { LazyIsland } from './LazyIsland';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

function Crash(): never {
  throw new Error('island crash');
}

describe('LazyIsland', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    pathname = '/';
  });

  it.each([
    ['/pt', SITE_LOCALE.pt],
    ['/', SITE_LOCALE.en],
  ])('speaks the language of %s when no locale is passed', (path, locale) => {
    pathname = path;
    render(
      <LazyIsland loading={null}>
        <Crash />
      </LazyIsland>,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      errorsClientContent[locale].componentExplanation,
    );
  });

  it('hands the reserved island height to the crash fallback', () => {
    render(
      <LazyIsland loading={null} minHeight="240px">
        <Crash />
      </LazyIsland>,
    );
    expect(screen.getByRole('alert').style.getPropertyValue('--eb-min-height')).toBe('240px');
  });

  it('shows its own failed node instead of the default box', () => {
    render(
      <LazyIsland loading={null} failed={<p>static copy</p>}>
        <Crash />
      </LazyIsland>,
    );
    expect(screen.getByText('static copy')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
