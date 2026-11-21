import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dawMixer, dawMixerCopy } from '@/content/daw-mixer';
import { SITE_LOCALE } from '@/content/site-locale';
import { DawMixerDesktop } from './DawMixerDesktop';

const PAGE_SKIP_LINK = '.skip-to-content';
const MIXER_SKIP_LINK = 'a.mixer-skip-link';

describe.each(Object.values(SITE_LOCALE))('desktop mixer skip link identity (%s)', (locale) => {
  const html = renderToStaticMarkup(
    createElement(DawMixerDesktop, { mixer: dawMixer[locale], copy: dawMixerCopy[locale] }),
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');

  it('is not the page skip link', () => {
    expect(
      doc.querySelectorAll(PAGE_SKIP_LINK),
      'the page skip link owns .skip-to-content, so the mixer link needs its own class',
    ).toHaveLength(0);
  });

  it('carries the mixer skip link class', () => {
    expect(doc.querySelectorAll(MIXER_SKIP_LINK)).toHaveLength(1);
  });
});
