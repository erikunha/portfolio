import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { aboutContent } from './about';
import { askFacts } from './ask-facts';
import { contactCopy } from './contact-copy';
import { SITE_LOCALE } from './site-locale';
import { WORK_SCOPE, WORK_SCOPE_SENTENCE } from './work-scope';

const LLMS_TXT = readFileSync(path.resolve(__dirname, '../public/llms.txt'), 'utf8');

describe.each(Object.values(SITE_LOCALE))('work scope (%s)', (locale) => {
  it('states the same scope in the About status and the contact facts', () => {
    expect(JSON.stringify(contactCopy[locale])).toContain(WORK_SCOPE[locale]);
    expect(JSON.stringify(aboutContent[locale])).toContain(WORK_SCOPE[locale]);
  });
});

describe('work scope wording', () => {
  it('is open to every arrangement in both locales', () => {
    expect(WORK_SCOPE[SITE_LOCALE.en]).toBe(
      'open to any arrangement: remote worldwide, hybrid or on-site',
    );
    expect(WORK_SCOPE[SITE_LOCALE.pt]).toBe(
      'aberto a qualquer formato: remoto global, híbrido ou presencial',
    );
  });

  it('reaches the ask facts and llms.txt, never framing Erik as remote-only', () => {
    expect(askFacts.openTo).toContain(WORK_SCOPE_SENTENCE);
    expect(askFacts.openTo).not.toMatch(/remote roles|async-first/i);
    expect(LLMS_TXT).toContain(WORK_SCOPE[SITE_LOCALE.en]);
  });
});
