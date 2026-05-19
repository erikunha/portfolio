// __tests__/hero-rsc.test.ts
// Source-grep test: verifies Hero RSC conversion per spec
// docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md §6.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HERO_SOURCE = readFileSync(
  path.resolve(__dirname, '../components/sections/Hero.tsx'),
  'utf-8',
);
const LAYOUT_CSS = readFileSync(path.resolve(__dirname, '../app/css/_layout.css'), 'utf-8');

describe('Hero RSC conversion', () => {
  it("Hero.tsx does NOT declare 'use client'", () => {
    expect(HERO_SOURCE).not.toMatch(/^['"]use client['"]/m);
  });

  it('Hero.tsx no longer imports useBreakpoint', () => {
    expect(HERO_SOURCE).not.toMatch(/useBreakpoint/);
  });

  it('Hero.tsx no longer imports useEffect or useRef', () => {
    expect(HERO_SOURCE).not.toMatch(
      /import\s*\{[^}]*\b(useEffect|useRef)\b[^}]*\}\s*from\s*['"]react['"]/,
    );
  });

  it('renders both .hero--desktop and .hero--mobile variants', () => {
    expect(HERO_SOURCE).toMatch(/hero hero--desktop/);
    expect(HERO_SOURCE).toMatch(/hero hero--mobile/);
  });

  it('imports HeroBootAnimation client island', () => {
    expect(HERO_SOURCE).toMatch(/from\s*['"](\.\.\/client\/HeroBootAnimation)['"]/);
  });

  it('imports HeroSystemFailure client island', () => {
    expect(HERO_SOURCE).toMatch(/from\s*['"](\.\.\/client\/HeroSystemFailure)['"]/);
  });

  it('HeroBootAnimation island exists with use client + matchMedia gate', () => {
    const island = readFileSync(
      path.resolve(__dirname, '../components/client/HeroBootAnimation.tsx'),
      'utf-8',
    );
    expect(island).toMatch(/^['"]use client['"]/m);
    expect(island).toMatch(/window\.matchMedia\(\s*['"]\(max-width:\s*768px\)['"]\s*\)/);
    expect(island).toMatch(/variant.*?['"]desktop['"]/);
    expect(island).toMatch(/variant.*?['"]mobile['"]/);
  });

  it('HeroSystemFailure island exists with use client', () => {
    const island = readFileSync(
      path.resolve(__dirname, '../components/client/HeroSystemFailure.tsx'),
      'utf-8',
    );
    expect(island).toMatch(/^['"]use client['"]/m);
  });

  it('_layout.css contains .hero--desktop / .hero--mobile media-query toggle', () => {
    expect(LAYOUT_CSS).toMatch(/\.hero--desktop\s*\{\s*display:\s*(block|flex)/);
    expect(LAYOUT_CSS).toMatch(/\.hero--mobile\s*\{\s*display:\s*none/);
    // The 768px media query must contain the actual toggle rules — not just any @media block.
    expect(LAYOUT_CSS).toMatch(
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.hero--desktop\s*\{\s*display:\s*none/,
    );
    expect(LAYOUT_CSS).toMatch(
      /@media\s*\(max-width:\s*768px\)[\s\S]*?\.hero--mobile\s*\{\s*display:\s*(block|flex)/,
    );
  });
});
