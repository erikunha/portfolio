import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import { About } from './About';

const CODE_SAMPLE = '.ab-code pre.ab-body';

function codeSample(locale: (typeof SITE_LOCALE)[keyof typeof SITE_LOCALE]): Element {
  const doc = new DOMParser().parseFromString(
    renderToStaticMarkup(<About locale={locale} />),
    'text/html',
  );
  const sample = doc.querySelector(CODE_SAMPLE);
  expect(sample, 'the about section renders its code sample').not.toBeNull();
  return sample as Element;
}

describe('the About code sample language (WCAG 3.1.2)', () => {
  it('marks the English comments as English on the pt-BR page', () => {
    expect(codeSample(SITE_LOCALE.pt).getAttribute('lang')).toBe(SITE_LOCALE.en);
  });

  it('adds no language override on the English page', () => {
    expect(codeSample(SITE_LOCALE.en).hasAttribute('lang')).toBe(false);
  });
});
