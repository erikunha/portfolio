import { render } from '@testing-library/react';
import { parse } from 'postcss';
import { describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesInMedia, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { contactContent } from '@/content/contact';
import { shellLoadingLabel, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome, shellChrome } from '@/content/terminal-chrome';
import { ContactFormLazy } from '../ContactForm/ContactFormLazy';
import { InteractiveShellLazy } from '../InteractiveShell/InteractiveShellLazy';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const NO_SCRIPT = /scripting:\s*none/;
const WIDE = /min-width:\s*480px/;

function renderShellLoading() {
  const { container } = render(
    <InteractiveShellLazy
      locale={SITE_LOCALE.en}
      ui={shellUi[SITE_LOCALE.en]}
      chrome={shellChrome[SITE_LOCALE.en]}
      loadingLabel={shellLoadingLabel[SITE_LOCALE.en]}
    />,
  );
  return container;
}

function renderContactLoading() {
  const { container } = render(
    <ContactFormLazy
      copy={contactContent[SITE_LOCALE.en]}
      chrome={contactChrome[SITE_LOCALE.en]}
      loadingLabel={contactContent[SITE_LOCALE.en].section.loadingLabel}
    />,
  );
  return container;
}

describe('island loading placeholders', () => {
  it('marks the shell placeholder busy, named and boxed while its chunk loads', () => {
    const placeholder = renderShellLoading().querySelector('.shell-loading');
    expect(placeholder?.getAttribute('role')).toBe('status');
    expect(placeholder?.getAttribute('aria-busy')).toBe('true');
    expect(placeholder?.getAttribute('aria-label')).toBe(shellLoadingLabel[SITE_LOCALE.en]);
  });

  it('marks the contact placeholder busy, named and boxed while its chunk loads', () => {
    const placeholder = renderContactLoading().querySelector('.contact-loading');
    expect(placeholder?.getAttribute('role')).toBe('status');
    expect(placeholder?.getAttribute('aria-busy')).toBe('true');
    expect(placeholder?.getAttribute('aria-label')).toBe(
      contactContent[SITE_LOCALE.en].section.loadingLabel,
    );
    expect(placeholder?.classList.contains('contact-shell')).toBe(true);
  });

  it.each(['.shell-loading', '.contact-loading'])(
    '%s holds a room instead of collapsing to zero, wider on phones than on wide screens',
    (selector) => {
      // behavioral-test-allow: the reserved room lives in the shipped stylesheet; jsdom has no layout
      const stylesheet = parse(readComponentsCss());
      const rem = (value: string | undefined) => Number.parseFloat(value ?? '0');
      const [phone, wide] = rulesWithSelector(stylesheet, selector)
        .map((rule) => rem(declValue(rule, 'min-height')))
        .filter((value) => value > 0);
      expect(rulesInMedia(stylesheet, WIDE, selector)).toHaveLength(1);
      expect(wide).toBeGreaterThan(0);
      expect(phone).toBeGreaterThan(wide ?? 0);
    },
  );

  it.each(['.shell-loading', '.contact-loading'])(
    '%s leaves the page when scripting is off, since nothing will ever replace it',
    (selector) => {
      // behavioral-test-allow: the no-script rule lives in the shipped stylesheet; jsdom has no scripting media feature
      const rules = rulesInMedia(parse(readComponentsCss()), NO_SCRIPT, selector);
      expect(rules.map((rule) => declValue(rule, 'display'))).toContain('none');
    },
  );

  it('gives the mixer boot box back its reserved height and hides its running line without scripting', () => {
    // behavioral-test-allow: the no-script rule lives in the shipped stylesheet; jsdom has no scripting media feature
    const stylesheet = parse(readComponentsCss());
    expect(
      rulesInMedia(stylesheet, NO_SCRIPT, '.daw-mixer-loading').map((rule) =>
        declValue(rule, 'min-height'),
      ),
    ).toContain('0');
    expect(
      rulesInMedia(stylesheet, NO_SCRIPT, '.mixer-boot-current').map((rule) =>
        declValue(rule, 'visibility'),
      ),
    ).toContain('hidden');
  });

  it('hides a measured block status that says it is fetching when scripting is off', () => {
    // behavioral-test-allow: the no-script rule lives in the shipped stylesheet; jsdom has no scripting media feature
    const rules = rulesInMedia(
      parse(readComponentsCss()),
      NO_SCRIPT,
      '[aria-busy="true"] .measured-status',
    );
    expect(rules.map((rule) => declValue(rule, 'visibility'))).toContain('hidden');
  });
});
