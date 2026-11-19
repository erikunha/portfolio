import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesWithResolvedSelector,
} from '@/__tests__/helpers/css-rules';
import { dawMixerCopy } from '@/content/daw-mixer';
import { SITE_LOCALE } from '@/content/site-locale';
import { RmsButtons } from './RmsButtons.client';

const CONTROLS = dawMixerCopy[SITE_LOCALE.en].controls;
const OWNED_BY_BASE_AND_VARIANT = [
  'background',
  'background-color',
  'border',
  'border-color',
  'border-style',
  'border-width',
  'box-shadow',
  'color',
  'cursor',
  'font',
  'font-family',
  'font-size',
  'font-weight',
  'text-decoration',
  'transition',
] as const;

function buttons() {
  const html = renderToStaticMarkup(
    createElement(RmsButtons, {
      buttons: ['R', 'M', 'S'],
      initialActive: ['M'],
      channelName: 'CH 01',
      buttonLabels: CONTROLS.buttons,
    }),
  );
  return [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('button')];
}

describe('RmsButtons on the shared base', () => {
  it('renders every button as a toggle .btn with no per-state class', () => {
    for (const button of buttons()) {
      expect(button.className).toBe('btn rms-btn');
      expect(button.getAttribute('data-variant')).toBe('toggle');
    }
  });

  it('marks the pressed state with aria-pressed alone', () => {
    const pressed = buttons().map((button) => button.getAttribute('aria-pressed'));
    expect(pressed).toEqual(['false', 'true', 'false']);
  });
});

describe('RmsButtons stylesheet', () => {
  it('leaves paint, border, font, cursor and motion to .btn', async () => {
    const root = await compiledSiteStylesheet();
    const declared = rulesWithResolvedSelector(root, '.rms-btn').flatMap((rule) =>
      OWNED_BY_BASE_AND_VARIANT.filter((property) => declValue(rule, property) !== undefined),
    );
    expect(declared).toEqual([]);
  });

  it('paints the resting toggle quiet and drops the hover glow', async () => {
    const root = await compiledSiteStylesheet();
    const [rest] = rulesWithResolvedSelector(root, '.btn[data-variant="toggle"]');
    expect(declValue(rest, 'background-color')).toBe('transparent');
    expect(declValue(rest, 'color')).toBe('var(--color-signal-400)');
    expect(declValue(rest, 'border-color')).toBe('var(--color-signal-quiet)');
    const [hover] = rulesWithResolvedSelector(root, '.btn[data-variant="toggle"]:hover');
    expect(declValue(hover, 'box-shadow')).toBe('none');
  });

  it('paints the pressed toggle with the accent, a tint and a glow', async () => {
    const root = await compiledSiteStylesheet();
    const [pressed] = rulesWithResolvedSelector(
      root,
      '.btn[data-variant="toggle"][aria-pressed="true"]',
    );
    expect(declValue(pressed, 'color')).toBe('var(--color-accent)');
    expect(declValue(pressed, 'border-color')).toBe('var(--color-accent)');
    expect(declValue(pressed, 'background-color')).toBe('var(--btn-toggle-fill)');
    expect(declValue(pressed, 'box-shadow')).toBe('var(--btn-toggle-glow)');
  });

  it('keeps the pressed glow above the hover rule that clears it', async () => {
    const root = await compiledSiteStylesheet();
    const order: string[] = [];
    root.walkRules((rule) => {
      if (rule.selector === '.btn[data-variant="toggle"]:hover') order.push('hover');
      if (rule.selector === '.btn[data-variant="toggle"][aria-pressed="true"]') {
        order.push('pressed');
      }
    });
    expect(order).toEqual(['hover', 'pressed']);
  });
});
