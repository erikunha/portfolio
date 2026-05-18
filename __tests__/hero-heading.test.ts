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
    expect(hero).toMatch(/hero__bio/);
    expect(hero).toMatch(/hero__name/);
  });
});
