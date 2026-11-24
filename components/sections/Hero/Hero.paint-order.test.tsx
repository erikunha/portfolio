import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import { Hero } from './Hero';

describe('Hero source order', () => {
  it('writes the identity block before the boot terminal, the order they paint in', () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(Hero, { locale: SITE_LOCALE.en })),
      'text/html',
    );
    const desktop = doc.querySelector('[data-testid="hero-desktop"]');
    const parts = [...(desktop?.children ?? [])].map((child) => child.className);
    expect(
      parts.indexOf('hero-bio'),
      'a browser that paints half a streamed document would show the terminal alone and push it down when the identity block arrives',
    ).toBeLessThan(parts.indexOf('hero-terminal'));
  });
});
