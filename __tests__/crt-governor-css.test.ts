import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRT_EFFECT_SELECTOR } from '@/lib/crt-effect-stepper';

// behavioral-test-allow: reads the shipped stylesheet; jsdom cannot cascade CSS animations
const crt = readFileSync(path.resolve(__dirname, '../app/css/crt.css'), 'utf-8');

const GOVERNED_RULE =
  /html\[data-crt-level\]:not\(\[data-crt-level="0"\]\)\s+:is\(([^)]*)\)\s*\{([^}]*)\}/;

function classesIn(list: string): string[] {
  return list
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort();
}

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return crt.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

describe('CRT frame governor in crt.css', () => {
  it('pauses exactly the layers the stepper drives, on every level above full rate', () => {
    const match = crt.match(GOVERNED_RULE);
    expect(
      match,
      'crt.css must pause the animated layers while data-crt-level is above 0',
    ).not.toBeNull();
    expect(
      classesIn(match?.[1] ?? ''),
      'the paused layers and CRT_EFFECT_SELECTOR must list the same classes: a layer paused here but never stepped freezes, one stepped but never paused fights its own CSS animation',
    ).toEqual(classesIn(CRT_EFFECT_SELECTOR));
  });

  it('sets nothing but the play state, so the reduced-motion rules still win', () => {
    const body = crt.match(GOVERNED_RULE)?.[2] ?? '';
    const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
    expect(
      properties,
      'the governed rule may only pause; the animation shorthand, opacity or will-change would revive an effect that reduced motion switched off',
    ).toEqual(['animation-play-state']);
  });

  it('leaves full rate to the unmodified animations', () => {
    expect(rule('.crt-noise')).toContain('animation: crt-noise-shift 0.6s steps(6) infinite');
    expect(rule('.crt-flicker')).toContain('animation: crt-flicker 4s infinite');
    expect(rule('.crt-scan-beam')).toContain('animation: crt-scan-beam 7s linear infinite');
  });

  it('lists every animated CRT layer in the stepper selector', () => {
    const animated = [...crt.matchAll(/(\.crt-[\w-]+)\s*\{[^}]*animation:\s*crt-[\w-]+/g)]
      .map((m) => m[1] as string)
      .sort();
    expect(
      animated,
      'a CRT layer that animates but is missing from CRT_EFFECT_SELECTOR keeps redrawing every frame after the governor degrades',
    ).toEqual(classesIn(CRT_EFFECT_SELECTOR));
  });
});
