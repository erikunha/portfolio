import { describe, expect, it } from 'vitest';
import { shellUi } from './shell-ui';
import { SITE_LOCALE } from './site-locale';

const NARROW_INPUT_CHARS = 24;

describe.each(Object.values(SITE_LOCALE))('narrow shell copy (%s)', (locale) => {
  const ui = shellUi[locale];

  it('rests on a placeholder short enough for the narrowest input and still names Erik', () => {
    expect(ui.mobilePlaceholder.length).toBeLessThanOrEqual(NARROW_INPUT_CHARS);
    expect(ui.mobilePlaceholder).toContain('Erik');
  });

  it('types only suggestions that fit the narrowest input', () => {
    for (const phrase of ui.mobileSuggestions) {
      expect(phrase.length, `"${phrase}" is wider than the narrow input`).toBeLessThanOrEqual(
        NARROW_INPUT_CHARS,
      );
    }
  });

  it('keeps every command the full suggestion list offers', () => {
    for (const command of ui.commands.filter((entry) => ui.suggestions.includes(entry))) {
      expect(ui.mobileSuggestions).toContain(command);
    }
  });

  it('tells a visitor without scripts that the shell needs JavaScript', () => {
    expect(ui.noscript).toContain('JavaScript');
  });
});
