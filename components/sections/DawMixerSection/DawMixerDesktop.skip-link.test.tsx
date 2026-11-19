import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dawMixer, dawMixerCopy } from '@/content/daw-mixer';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { DawMixerDesktop } from './DawMixerDesktop';

const TAB_STOPS = 'a[href], button, [role="slider"], [tabindex]:not([tabindex="-1"])';
const CONTROLS = 'button, [role="slider"]';
const NO_INDEX = -1;

function render(locale: SiteLocale): Document {
  const html = renderToStaticMarkup(
    createElement(DawMixerDesktop, { mixer: dawMixer[locale], copy: dawMixerCopy[locale] }),
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

const follows = (anchor: Element, node: Element) =>
  Boolean(anchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);

describe.each(Object.values(SITE_LOCALE))('desktop mixer skip link (%s)', (locale) => {
  it('is the first tab stop in the mixer', () => {
    const doc = render(locale);
    const first = doc.querySelector(TAB_STOPS);
    expect(first?.tagName).toBe('A');
    expect(first?.getAttribute('href')?.startsWith('#')).toBe(true);
    expect(doc.querySelectorAll(CONTROLS).length).toBeGreaterThan(0);
  });

  it('is named from the locale copy', () => {
    const link = render(locale).querySelector('a[href^="#"]');
    expect(dawMixerCopy[locale].skipLabel.length).toBeGreaterThan(0);
    expect(link?.textContent).toBe(dawMixerCopy[locale].skipLabel);
  });

  it('targets an element that follows every control', () => {
    const doc = render(locale);
    const link = doc.querySelector('a[href^="#"]');
    const id = link?.getAttribute('href')?.slice(1) ?? '';
    const target = id ? doc.getElementById(id) : null;
    expect(target, 'the fragment resolves inside the mixer').not.toBeNull();
    const controls = Array.from(doc.querySelectorAll(CONTROLS));
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(follows(control, target as Element), 'the target comes after each control').toBe(true);
    }
    expect(target?.contains(doc.querySelector(CONTROLS))).toBe(false);
  });

  it('can take focus from the fragment jump and joins no tab order of its own', () => {
    const doc = render(locale);
    const link = doc.querySelector('a[href^="#"]');
    const target = doc.getElementById(link?.getAttribute('href')?.slice(1) ?? '');
    expect(target?.getAttribute('tabindex')).toBe(String(NO_INDEX));
  });

  it('keeps every control in the natural tab order', () => {
    const doc = render(locale);
    const positive = Array.from(doc.querySelectorAll('[tabindex]')).filter(
      (node) => Number(node.getAttribute('tabindex')) > 0,
    );
    expect(positive).toHaveLength(0);
    const rovingOut = Array.from(doc.querySelectorAll(CONTROLS)).filter(
      (node) => node.getAttribute('tabindex') === String(NO_INDEX),
    );
    expect(rovingOut, 'no control is parked out of the tab order').toHaveLength(0);
  });

  it('needs no script: a plain anchor with no handler', () => {
    const html = renderToStaticMarkup(
      createElement(DawMixerDesktop, { mixer: dawMixer[locale], copy: dawMixerCopy[locale] }),
    );
    const link = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('a[href^="#"]') as HTMLAnchorElement;
    expect(link.getAttributeNames().filter((name) => name.startsWith('on'))).toHaveLength(0);
    expect(link.closest('[data-testid="daw-mixer-desktop"]')).not.toBeNull();
  });
});
