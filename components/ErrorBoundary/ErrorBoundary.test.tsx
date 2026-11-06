import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorsClientContent } from '@/content/errors-client';
import { SITE_LOCALE } from '@/content/site-locale';
import { ErrorBoundary } from './ErrorBoundary.client';

function Crash(): never {
  throw new Error('island crash');
}

describe('ErrorBoundary default fallback', () => {
  const reload = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.stubGlobal('location', { ...window.location, reload });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    reload.mockClear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(Object.values(SITE_LOCALE))(
    'tells the visitor what failed, that the page works and offers one reload in %s',
    (locale) => {
      const copy = errorsClientContent[locale];
      render(
        <ErrorBoundary locale={locale}>
          <Crash />
        </ErrorBoundary>,
      );
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(`! ${copy.componentUnavailable}`);
      expect(alert.textContent).toContain(copy.componentExplanation);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]?.textContent).toBe(copy.reloadLabel);
    },
  );

  it('reloads the page when the action is pressed', () => {
    render(
      <ErrorBoundary locale={SITE_LOCALE.en}>
        <Crash />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the box height the island reserved', () => {
    render(
      <ErrorBoundary locale={SITE_LOCALE.en} minHeight="320px">
        <Crash />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').style.getPropertyValue('--eb-min-height')).toBe('320px');
  });

  it('renders nothing for a decorative island that passes a null fallback', () => {
    const { container } = render(
      <ErrorBoundary fallback={null}>
        <Crash />
      </ErrorBoundary>,
    );
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
