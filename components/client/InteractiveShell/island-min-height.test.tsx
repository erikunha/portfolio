import tailwindcss from '@tailwindcss/postcss';
import { render, screen } from '@testing-library/react';
import postcss from 'postcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactFormLazy } from '@/components/client/ContactForm/ContactFormLazy';
import { InteractiveShellLazy } from '@/components/client/InteractiveShell/InteractiveShellLazy';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/client/ContactForm/ContactForm', () => {
  throw new Error('chunk failed to load');
});
vi.mock('@/components/client/InteractiveShell/InteractiveShell', () => {
  throw new Error('chunk failed to load');
});

const MIN_HEIGHT_VAR = '--eb-min-height';
const ISLAND_MIN_HEIGHT_PROPERTY = '--island-min-height';
const ISLAND_MIN_HEIGHT_REFERENCE = `var(${ISLAND_MIN_HEIGHT_PROPERTY})`;
const RESOLVED_ISLAND_MIN_HEIGHT = 'calc(5 * var(--spacing-target))';
const RESOLVED_SPACING_TARGET = '2.75rem';
const ENTRY_CSS = `
@import "tailwindcss";
@import "./app/css/theme.css";
@import "./app/css/components-shell.css";
`;

function declarationValue(css: string, property: string): string | undefined {
  let found: string | undefined;
  postcss.parse(css).walkDecls(property, (decl) => {
    found = decl.value;
  });
  return found;
}

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

describe('the shell and contact islands reserve one shared height', () => {
  it('points the contact form box at the shared property', async () => {
    render(<ContactFormLazy copy={{} as never} chrome={{} as never} loadingLabel="loading" />);
    const alert = await screen.findByRole('alert');
    expect(alert.style.getPropertyValue(MIN_HEIGHT_VAR)).toBe(ISLAND_MIN_HEIGHT_REFERENCE);
  });

  it('points the interactive shell box at the shared property', async () => {
    render(
      <InteractiveShellLazy
        locale={SITE_LOCALE.en}
        ui={{} as never}
        chrome={{} as never}
        loadingLabel="loading"
      />,
    );
    const alert = await screen.findByRole('alert');
    expect(alert.style.getPropertyValue(MIN_HEIGHT_VAR)).toBe(ISLAND_MIN_HEIGHT_REFERENCE);
  });

  it('compiles the shared property to five touch targets of 2.75rem', async () => {
    // behavioral-test-allow: the property lives in the shipped stylesheet; jsdom does not compute CSS
    const { css } = await postcss([tailwindcss()]).process(ENTRY_CSS, {
      from: `${process.cwd()}/entry.css`,
    });
    expect(declarationValue(css, ISLAND_MIN_HEIGHT_PROPERTY)).toBe(RESOLVED_ISLAND_MIN_HEIGHT);
    expect(declarationValue(css, '--spacing-target')).toBe(RESOLVED_SPACING_TARGET);
  });
});
