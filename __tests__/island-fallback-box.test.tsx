import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTACT_FORM_MIN_HEIGHT,
  ContactFormLazy,
} from '@/components/client/ContactForm/ContactFormLazy';
import {
  InteractiveShellLazy,
  SHELL_MIN_HEIGHT,
} from '@/components/client/InteractiveShell/InteractiveShellLazy';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/client/ContactForm/ContactForm', () => {
  throw new Error('chunk failed to load');
});
vi.mock('@/components/client/InteractiveShell/InteractiveShell', () => {
  throw new Error('chunk failed to load');
});

const MIN_HEIGHT_VAR = '--eb-min-height';

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

describe('a crashed island keeps the box its loading state reserved', () => {
  it('keeps the contact form height', async () => {
    render(<ContactFormLazy copy={{} as never} chrome={{} as never} loadingLabel="loading" />);
    const alert = await screen.findByRole('alert');
    expect(alert.style.getPropertyValue(MIN_HEIGHT_VAR)).toBe(CONTACT_FORM_MIN_HEIGHT);
  });

  it('keeps the interactive shell height', async () => {
    render(
      <InteractiveShellLazy
        locale={SITE_LOCALE.en}
        ui={{} as never}
        chrome={{} as never}
        loadingLabel="loading"
      />,
    );
    const alert = await screen.findByRole('alert');
    expect(alert.style.getPropertyValue(MIN_HEIGHT_VAR)).toBe(SHELL_MIN_HEIGHT);
  });
});
