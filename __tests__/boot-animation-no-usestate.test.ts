// __tests__/boot-animation-no-usestate.test.ts
//
// Locks in CLAUDE.md's "Rendering model" invariant:
//
//   "The Matrix dialog loop MUST use `useRef.textContent` mutation, NOT
//    per-keystroke `useState`. Per-state re-renders tank INP."
//
// Closes audit Theme 1.8 — the doc claimed "this is enforced by a Vitest
// test" but no such test existed. The boot animation drives a per-character
// DOM mutation loop at ~60 chars/sec for several seconds; if any of that
// loop went through React state (setState), every frame would trigger a
// reconciliation and INP would balloon past the 200ms budget under 4x CPU
// throttle (the audit's mobile Lighthouse profile).
//
// This is source-grep by necessity: the invariant is about an implementation
// pattern ("don't call useState in the loop file"), not a runtime behavior.
// The right pattern for that kind of invariant is to scan the source. Per
// audit Standard 5 the OTHER source-grep tests (those that fake-asserted on
// route ordering) were replaced by behavioral tests; this one earns its
// keep because the implementation pattern IS the contract.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const BOOT_ANIMATION = readFileSync(path.resolve(__dirname, '../lib/boot-animation.ts'), 'utf-8');

const HERO_BOOT = readFileSync(
  path.resolve(__dirname, '../components/client/HeroBootAnimation.tsx'),
  'utf-8',
);

// Strip line + block comments + string literals so the assertions can't be
// fooled by the word "useState" inside a comment or message body.
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

describe('boot-animation: useRef.textContent invariant (audit Theme 1.8 + CLAUDE.md Rendering model)', () => {
  describe('lib/boot-animation.ts (the typing loop driver)', () => {
    const code = stripCommentsAndStrings(BOOT_ANIMATION);

    it('does NOT import useState from React (or anywhere)', () => {
      // The file is a pure DOM-mutation driver — it should have no React
      // dependency at all. The audit's specific concern is useState; this
      // assertion also catches any back-door React import.
      expect(code).not.toMatch(/\buseState\b/);
      expect(code).not.toMatch(/from\s+['"]react['"]/);
    });

    it('uses textContent mutation for the per-character typing pattern', () => {
      // The CLAUDE.md mandate is positive: the loop MUST mutate textContent.
      // At least one += assignment to .textContent is the canonical pattern.
      expect(code).toMatch(/\.textContent\s*\+?=/);
    });
  });

  describe('components/client/HeroBootAnimation.tsx (the React island that owns the DOM ref)', () => {
    const code = stripCommentsAndStrings(HERO_BOOT);

    it('imports useRef (the official escape hatch for the typing loop)', () => {
      expect(code).toMatch(/\buseRef\b/);
    });

    it('does NOT call useState anywhere in the file', () => {
      // The audit's concern is the dialog loop; if useState appears anywhere
      // in this file, the next refactor could trivially funnel character
      // updates through it. Easier to ban the symbol from this file entirely
      // than to whitelist specific call sites.
      expect(code).not.toMatch(/\buseState\s*\(/);
      expect(code).not.toMatch(/[{,]\s*useState\s*[,}]/);
    });
  });
});
