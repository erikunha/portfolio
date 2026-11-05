import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { ContactTimezoneLazy } from './ContactTimezoneLazy';

vi.mock('./ContactTimezone.client', () => {
  throw new Error('chunk failed to load');
});

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ContactTimezoneLazy when the island chunk fails', () => {
  it('keeps the server-rendered panel instead of an error box', async () => {
    render(
      <ContactTimezoneLazy copy={contactCopy[SITE_LOCALE.en].timezone}>
        <div data-testid="static-panel">static map</div>
      </ContactTimezoneLazy>,
    );

    await waitFor(() => expect(console.error).toHaveBeenCalled());

    expect(screen.getByTestId('static-panel')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
