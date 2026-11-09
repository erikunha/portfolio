import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_DIR = path.resolve(__dirname, '../app/css');
const COMPOSITOR_PROPERTIES = new Set([
  'opacity',
  'transform',
  'translate',
  'rotate',
  'scale',
  'clip-path',
]);
const MAIN_THREAD_KEYFRAMES: Record<string, readonly string[]> = {
  'badge-pulse': ['box-shadow'],
  'ctz-march': ['stroke-dashoffset'],
  'mixer-boot-blink': ['visibility'],
  'measured-load-fill': ['width'],
};

function keyframesByName(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const file of readdirSync(CSS_DIR).filter((name) => name.endsWith('.css'))) {
    // behavioral-test-allow: reads the shipped stylesheet source; jsdom cannot run the compositor
    const css = readFileSync(path.join(CSS_DIR, file), 'utf-8');
    for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
      let depth = 1;
      let cursor = (match.index ?? 0) + match[0].length;
      const start = cursor;
      while (depth > 0 && cursor < css.length) {
        if (css[cursor] === '{') depth += 1;
        if (css[cursor] === '}') depth -= 1;
        cursor += 1;
      }
      const body = css.slice(start, cursor - 1);
      const properties = new Set<string>();
      for (const declaration of body.matchAll(/(?:^|[;{\s])(-{0,2}[a-z][\w-]*)\s*:/g)) {
        properties.add(declaration[1] as string);
      }
      found.set(match[1] as string, properties);
    }
  }
  return found;
}

describe('keyframes animate only what the compositor can run', () => {
  const keyframes = keyframesByName();

  it('finds the keyframes it is meant to guard', () => {
    expect(keyframes.size).toBeGreaterThan(15);
  });

  for (const [name, properties] of keyframes) {
    it(`${name} animates compositor properties only`, () => {
      const allowed = MAIN_THREAD_KEYFRAMES[name] ?? [];
      const offenders = [...properties].filter(
        (property) => !COMPOSITOR_PROPERTIES.has(property) && !allowed.includes(property),
      );
      expect(
        offenders,
        `@keyframes ${name} animates ${offenders.join(', ')}: a property the compositor cannot run repaints on the main thread every step (Lighthouse non-composited-animations); animate opacity, transform or clip-path, or list the keyframes with its reason in MAIN_THREAD_KEYFRAMES`,
      ).toEqual([]);
    });
  }
});
