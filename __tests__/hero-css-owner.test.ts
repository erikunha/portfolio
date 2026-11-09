import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_DIR = path.resolve(__dirname, '../app/css');
const HERO_OWNER = 'components-hero.css';
const HERO_SELECTOR = /hero-/;
const KEYFRAMES = /^@(-\w+-)?keyframes\b/;
const COMMENT = /\/\*[\s\S]*?\*\//g;

interface Rule {
  selector: string;
  body: string;
}

function collectStyleRules(source: string, skipKeyframes: boolean): Rule[] {
  const rules: Rule[] = [];
  let depth = 0;
  let start = 0;
  let prelude = '';
  let bodyStart = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      if (depth === 0) {
        prelude = source.slice(start, i).trim();
        bodyStart = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const body = source.slice(bodyStart, i);
        if (prelude.startsWith('@')) {
          if (!(skipKeyframes && KEYFRAMES.test(prelude))) {
            rules.push(...collectStyleRules(body, skipKeyframes));
          }
        } else {
          rules.push({ selector: prelude, body });
        }
        start = i + 1;
      }
    }
  }
  return rules;
}

function heroRulesOutsideOwner(): string[] {
  return readdirSync(CSS_DIR)
    .filter((file) => file.endsWith('.css') && file !== HERO_OWNER)
    .flatMap((file) => {
      // behavioral-test-allow: reads the shipped stylesheet partials; jsdom cannot evaluate CSS ownership
      const source = readFileSync(path.join(CSS_DIR, file), 'utf-8').replace(COMMENT, '');
      return collectStyleRules(source, true)
        .filter((rule) => HERO_SELECTOR.test(rule.selector))
        .map((rule) => `${file}: ${rule.selector.replace(/\s+/g, ' ')}`);
    });
}

describe('hero css ownership', () => {
  it('keeps every hero selector rule in components-hero.css', () => {
    expect(
      heroRulesOutsideOwner(),
      'Hero layout and boot rules live in app/css/components-hero.css only. Keyframes may stay ' +
        'in animations.css; a hero selector rule elsewhere splits the cascade across files.',
    ).toEqual([]);
  });
});
