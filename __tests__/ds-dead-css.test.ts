import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from './helpers/components-css';
import { rulesWithSelector } from './helpers/css-rules';

const KBD_SELECTOR = '.kbd-key';
const STAT_TILE_IN_HERO = '.hero-stats .stat-tile';
const UTILITY_OWNED_PROPS = [
  'display',
  'border',
  'color',
  'padding',
  'font-family',
  'font-size',
  'border-radius',
];

function declaredProps(selector: string): string[] {
  const root = parse(readComponentsCss());
  return rulesWithSelector(root, selector).flatMap((rule) =>
    rule.nodes.flatMap((node) => (node.type === 'decl' ? [node.prop] : [])),
  );
}

describe('design-system stylesheet declares nothing a component utility overrides', () => {
  it('leaves display, border, color, padding, font and radius of KbdKey to its utilities', () => {
    const props = declaredProps(KBD_SELECTOR);
    expect(props.filter((prop) => UTILITY_OWNED_PROPS.includes(prop))).toEqual([]);
  });

  it('gives the non-interactive KbdKey no pointer cursor and no hover state', () => {
    expect(declaredProps(KBD_SELECTOR)).not.toContain('cursor');
    const root = parse(readComponentsCss());
    expect(rulesWithSelector(root, `${KBD_SELECTOR}:hover`)).toEqual([]);
  });

  it('leaves the StatTile padding inside the hero grid to the component utilities', () => {
    expect(declaredProps(STAT_TILE_IN_HERO)).toEqual([]);
  });
});
