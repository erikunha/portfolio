import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss, { type AtRule, type Declaration, type Node, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { componentsCssFiles, resolveViewportTokens } from './helpers/components-css';

const MODULES_PARTIAL = 'components-modules.css';
const MODULES_PATH = path.resolve(__dirname, '../app/css', MODULES_PARTIAL);
const ESTIMATE_PROPERTY = '--module-estimate';
const BASE_SELECTOR = '.module-deferred';
const REM_PX = 16;
const LAST_WIDTH_PX = 1920;
const COARSE_CEILING_REM = 48;
const SUBPIXEL_BELOW_PX = 0.02;
const MEDIA_FEATURE = /^\(\s*([\w-]+)\s*:\s*([^)]+?)\s*\)$/;
const LENGTH = /^([\d.]+)(rem|px)$/;
const AND_JOIN = /\s+and\s+/;

type Step = readonly [fromRem: number, estimateRem: number];

type Ladder = {
  base: number;
  steps: readonly Step[];
  coarse?: number;
};

const LADDERS: Record<string, Ladder> = {
  'sec-git-log': {
    base: 205.625,
    steps: [
      [21.25, 198.125],
      [21.875, 195.625],
      [22.5, 184.375],
      [23.75, 171.875],
      [26.25, 156.25],
      [30.625, 138.75],
      [37.5, 128.75],
      [45.625, 109.375],
    ],
  },
  'sec-hottest-takes': {
    base: 215,
    steps: [
      [20.625, 210],
      [21.25, 202.5],
      [22.5, 183.125],
      [24.375, 166.875],
      [26.875, 157.5],
      [28.75, 146.25],
      [32.5, 129.375],
      [38.125, 119.375],
      [41.25, 108.75],
      [46.25, 106.25],
      [53.75, 93.75],
      [62.5, 82.5],
    ],
  },
  'sec-guitar': {
    base: 199.375,
    coarse: 230,
    steps: [
      [48, 91.875],
      [80, 73.75],
    ],
  },
  'sec-contact': {
    base: 170.625,
    steps: [
      [22.5, 161.25],
      [30, 151.25],
      [48, 123.75],
      [64, 66.875],
    ],
  },
};

const DEFERRED_BASE_REM = 32.5;

type Environment = { widthPx: number; coarse: boolean };
type Entry = { selector: string; conditions: string[]; rem: number };

function toRem(value: string): number {
  const match = value.trim().match(LENGTH);
  if (!match) throw new Error(`"${value}" is not a rem or px length`);
  const amount = Number.parseFloat(match[1] ?? '');
  return match[2] === 'rem' ? amount : amount / REM_PX;
}

function ownerRule(node: Declaration): Rule {
  let parent: Node['parent'] = node.parent;
  while (parent && parent.type !== 'rule') parent = parent.parent;
  if (!parent) throw new Error(`${ESTIMATE_PROPERTY} sits outside a rule`);
  return parent as Rule;
}

function conditionsOf(node: Declaration): string[] {
  const conditions: string[] = [];
  let parent: Node['parent'] = node.parent;
  while (parent) {
    if (parent.type === 'atrule') {
      const rule = parent as AtRule;
      if (rule.name === 'media') conditions.unshift(rule.params);
      else if (rule.name !== 'layer') throw new Error(`@${rule.name} is not understood here`);
    }
    parent = parent.parent;
  }
  return conditions;
}

function readEntries(): Entry[] {
  // behavioral-test-allow: reads the shipped stylesheet partial; jsdom cannot evaluate media-query resolution
  const source = resolveViewportTokens(readFileSync(MODULES_PATH, 'utf-8'));
  const entries: Entry[] = [];
  postcss.parse(source).walkDecls(ESTIMATE_PROPERTY, (decl) => {
    entries.push({
      selector: ownerRule(decl).selector,
      conditions: conditionsOf(decl),
      rem: toRem(decl.value),
    });
  });
  return entries;
}

function matches(condition: string, environment: Environment): boolean {
  return condition.split(AND_JOIN).every((part) => {
    const match = part.trim().match(MEDIA_FEATURE);
    if (!match) throw new Error(`media condition "${part}" is not understood here`);
    const [, feature, value] = match;
    if (feature === 'min-width') return environment.widthPx >= toRem(value ?? '') * REM_PX;
    if (feature === 'pointer' && value === 'coarse') return environment.coarse;
    throw new Error(`media feature "${feature}: ${value}" is not understood here`);
  });
}

function resolvedRem(entries: Entry[], id: string, environment: Environment): number {
  const applies = (selector: string) =>
    entries.filter(
      (entry) =>
        entry.selector === selector &&
        entry.conditions.every((condition) => matches(condition, environment)),
    );
  const own = applies(`#${id}`).at(-1) ?? applies(BASE_SELECTOR).at(-1);
  if (!own) throw new Error(`#${id} resolves no estimate`);
  return own.rem;
}

function expectedRem(ladder: Ladder, environment: Environment): number {
  const touchBand = environment.coarse && environment.widthPx < COARSE_CEILING_REM * REM_PX;
  if (touchBand && ladder.coarse !== undefined) return ladder.coarse;
  const reached = ladder.steps.filter(([from]) => environment.widthPx >= from * REM_PX);
  return reached.at(-1)?.[1] ?? ladder.base;
}

describe('deferred module estimate ladders', () => {
  const entries = readEntries();

  it('ships components-modules.css through globals.css', () => {
    expect(componentsCssFiles()).toContain(MODULES_PARTIAL);
  });

  it('keeps the generic placeholder estimate on .module-deferred', () => {
    const base = entries.filter((entry) => entry.selector === BASE_SELECTOR);
    expect(base.map((entry) => [entry.conditions, entry.rem])).toEqual([[[], DEFERRED_BASE_REM]]);
  });

  it('owns only the four measured sections', () => {
    const ids = new Set(
      entries.map((entry) => entry.selector).filter((selector) => selector !== BASE_SELECTOR),
    );
    expect(ids).toEqual(new Set(Object.keys(LADDERS).map((id) => `#${id}`)));
  });

  for (const [id, ladder] of Object.entries(LADDERS)) {
    for (const coarse of [false, true]) {
      it(`#${id} resolves its measured estimate at every width, ${coarse ? 'coarse' : 'fine'} pointer`, () => {
        const mismatches: string[] = [];
        for (let widthPx = 0; widthPx <= LAST_WIDTH_PX; widthPx += 1) {
          const environment = { widthPx, coarse };
          const actual = resolvedRem(entries, id, environment);
          const expected = expectedRem(ladder, environment);
          if (actual !== expected)
            mismatches.push(`${widthPx}px: ${actual}rem, want ${expected}rem`);
        }
        expect(mismatches).toEqual([]);
      });
    }

    it(`#${id} changes estimate exactly at each band edge`, () => {
      for (const [from, estimate] of ladder.steps) {
        const edgePx = from * REM_PX;
        const at = resolvedRem(entries, id, { widthPx: edgePx, coarse: false });
        const below = resolvedRem(entries, id, {
          widthPx: edgePx - SUBPIXEL_BELOW_PX,
          coarse: false,
        });
        expect(at).toBe(estimate);
        expect(below).not.toBe(estimate);
      }
    });
  }
});
