import { describe, expect, it } from 'vitest';
import { SHELL_PROMPT, SHELL_USER } from './brand';
import { footerContent } from './footer';
import { careerCopy } from './git-log';
import { heroClientContent } from './hero-client';
import { shellUi } from './shell-ui';
import { SITE_LOCALE } from './site-locale';
import { contactChrome, shellChrome } from './terminal-chrome';

const LOCALES = Object.values(SITE_LOCALE);

describe('shell prompt single source', () => {
  it('derives the prompt from the shell user', () => {
    expect(SHELL_PROMPT).toBe(`${SHELL_USER}:~$`);
    expect(SHELL_PROMPT).toBe('erik@portfolio:~$');
  });

  it.each(LOCALES)('every prompt-bearing export for %s uses SHELL_PROMPT', (locale) => {
    expect(shellUi[locale].prompt).toBe(SHELL_PROMPT);
    expect(footerContent[locale].prompt).toBe(SHELL_PROMPT);
    expect(careerCopy[locale].prompt).toBe(SHELL_PROMPT);
    expect(heroClientContent[locale].bootPrompt).toBe(SHELL_PROMPT);
  });

  it.each(LOCALES)('chrome labels for %s start with the shell user', (locale) => {
    expect(shellChrome[locale].promptLabel.startsWith(SHELL_USER)).toBe(true);
    expect(contactChrome[locale].promptLabel.startsWith(SHELL_USER)).toBe(true);
    expect(footerContent[locale].user).toBe(SHELL_USER);
  });
});
