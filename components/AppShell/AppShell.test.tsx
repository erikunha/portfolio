import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import { AppShell } from './AppShell.client';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('../responsive/CRTOverlay', () => ({
  CRTOverlay: () => {
    throw new Error('decorative crash');
  },
}));
vi.mock('../responsive/SectionNavigation', () => ({
  SectionNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SectionNavigation: () => null,
}));
vi.mock('../responsive/DesktopTopbar', () => ({ DesktopTopbar: () => null }));
vi.mock('../responsive/Dock', () => ({ Dock: () => null }));
vi.mock('../responsive/MobileTitleBar', () => ({ MobileTitleBar: () => null }));
vi.mock('../responsive/PositionMeter', () => ({ PositionMeter: () => null }));
vi.mock('../responsive/StatusBar', () => ({ StatusBar: () => null }));
vi.mock('../client/OfflineNotice', () => ({ OfflineNotice: () => null }));
vi.mock('../client/ToTopButton', () => ({ ToTopButton: () => null }));

beforeEach(() => {
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

describe('AppShell when the decorative CRT overlay throws', () => {
  it('renders nothing for it and keeps the page content', () => {
    render(
      <AppShell brand={null} chrome={{} as never} locale={SITE_LOCALE.en} skipLabel="skip">
        <p>page body</p>
      </AppShell>,
    );
    expect(screen.getByText('page body')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
