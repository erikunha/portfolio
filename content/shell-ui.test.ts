import { describe, expect, it } from 'vitest';
import { shellUi } from './shell-ui';
import { SITE_LOCALE } from './site-locale';

describe('shell welcome', () => {
  it('tells the English reader that a chip only fills the prompt', () => {
    expect(shellUi[SITE_LOCALE.en].mobileWelcome).toContain('fill the prompt from a chip');
  });

  it('tells the Portuguese reader that a chip only fills the prompt', () => {
    expect(shellUi[SITE_LOCALE.pt].mobileWelcome).toContain(
      'preencha o prompt a partir de um chip',
    );
  });
});
