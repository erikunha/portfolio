import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const hero = readFileSync(path.resolve(__dirname, '../components/sections/Hero.tsx'), 'utf-8');

describe('Hero headings', () => {
  it('DesktopHero renders an h1 element', () => {
    const desktopFn = hero.slice(
      hero.indexOf('function DesktopHero'),
      hero.indexOf('function MobileHero'),
    );
    expect(desktopFn).toMatch(/<h1/);
  });

  it('DesktopHero h1 is visually hidden (sr-only pattern)', () => {
    const desktopFn = hero.slice(
      hero.indexOf('function DesktopHero'),
      hero.indexOf('function MobileHero'),
    );
    expect(desktopFn).toMatch(/sr-only|visually-hidden|clip/);
  });
});
