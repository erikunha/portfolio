import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dawMixer, dawMixerCopy } from '@/content/daw-mixer';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { DawMixerDesktop } from './DawMixerDesktop';

function render(locale: SiteLocale): Document {
  const html = renderToStaticMarkup(
    createElement(DawMixerDesktop, { mixer: dawMixer[locale], copy: dawMixerCopy[locale] }),
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

const accessibleNames = (doc: Document) =>
  Array.from(doc.querySelectorAll('[aria-label]'), (el) => el.getAttribute('aria-label') ?? '');

const valueTexts = (doc: Document) =>
  Array.from(doc.querySelectorAll('[aria-valuetext]'), (el) => el.getAttribute('aria-valuetext'));

describe.each(Object.values(SITE_LOCALE))('desktop mixer accessible names (%s)', (locale) => {
  const { controls } = dawMixerCopy[locale];

  it('names every meter, fader and toggle from the locale copy', () => {
    const names = accessibleNames(render(locale));
    for (const ch of dawMixer[locale].channels) {
      expect(names, `${ch.name} meter`).toContain(`${ch.name} ${controls.vuMeter}`);
      expect(names, `${ch.name} fader`).toContain(`${ch.name} ${controls.fader}`);
      for (const button of ch.buttons) {
        const spoken = (controls.buttons as Record<string, string>)[button] ?? button;
        expect(names, `${ch.name} ${button}`).toContain(`${ch.name} ${spoken}`);
      }
    }
  });

  it('states knob angles with the locale degree word', () => {
    const texts = valueTexts(render(locale)).filter((text) => text?.includes(controls.degrees));
    expect(texts.length, 'every knob reports its angle in degrees').toBe(
      dawMixer[locale].channels.length * 2,
    );
  });
});

describe('desktop mixer on the pt route', () => {
  it('leaves no English control name or value text', () => {
    const doc = render(SITE_LOCALE.pt);
    const english = dawMixerCopy[SITE_LOCALE.en].controls;
    const spoken = [...accessibleNames(doc), ...valueTexts(doc)].join('\n');
    for (const phrase of [english.vuMeter, english.degrees, english.buttons.R, english.buttons.M]) {
      expect(spoken, `"${phrase}" is English on the pt page`).not.toContain(phrase);
    }
  });
});
