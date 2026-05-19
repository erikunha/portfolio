import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const hero = readFileSync(path.resolve(__dirname, '../components/sections/Hero.tsx'), 'utf-8');

describe('Hero headings', () => {
  it('Hero RSC renders an h1 element', () => {
    // Hero is now a single RSC; both desktop and mobile h1s live in Hero.tsx.
    expect(hero).toMatch(/<h1/);
  });

  it('Hero RSC h1 is inside the bio panel on desktop and the inner wrapper on mobile', () => {
    // Desktop: h1.hero__name must appear inside the hero__bio block.
    // Regex confirms the className sequence: hero__bio ... h1 ... hero__name (DOM order).
    expect(hero).toMatch(/hero__bio[\s\S]*?<h1[^>]*hero__name/);
    // Mobile: h1.hero__name must appear inside the hero__inner block.
    expect(hero).toMatch(/hero__inner[\s\S]*?<h1[^>]*hero__name/);
  });
});
