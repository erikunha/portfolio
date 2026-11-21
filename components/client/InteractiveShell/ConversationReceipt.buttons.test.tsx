import { within } from '@testing-library/react';
import type { AtRule, Rule } from 'postcss';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesWithResolvedSelector,
} from '@/__tests__/helpers/css-rules';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { ConversationReceipt } from './ConversationReceipt.client';

const ID = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const SELECTOR_PART = /\.[\w-]+|\[[^\]]+\]|:(?!not\b)(?!:)[\w-]+/g;
const RECEIPT_BUTTON = '.btn.shell-receipt-button';
const FORGET_BUTTON = `${RECEIPT_BUTTON}.shell-receipt-forget`;
const OVERRIDES: readonly (readonly [string, readonly string[]])[] = [
  [RECEIPT_BUTTON, ['.btn']],
  [`${RECEIPT_BUTTON}[data-copied]`, ['.btn[data-variant="secondary"]']],
  [FORGET_BUTTON, ['.btn[data-variant="secondary"]']],
  [`${RECEIPT_BUTTON}[aria-disabled="true"]`, ['.btn[aria-disabled="true"]']],
];

let mounted: MountedClient | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const specificity = (selector: string): number => selector.match(SELECTOR_PART)?.length ?? 0;

const inLayer = (rules: Rule[]): Rule[] =>
  rules.filter(
    (rule) => rule.parent?.type === 'atrule' && (rule.parent as AtRule).name === 'layer',
  );

describe('receipt buttons', () => {
  it('render on the shared base as the secondary variant', async () => {
    mounted = await mountClient(
      createElement(ConversationReceipt, {
        ui: shellUi[SITE_LOCALE.en],
        states: shellStates[SITE_LOCALE.en],
        requestId: ID,
        busy: false,
        announce: () => undefined,
        onForgotten: () => undefined,
      }),
    );
    const buttons = within(mounted.container).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.classList.contains('btn')).toBe(true);
      expect(button.classList.contains('shell-control')).toBe(false);
      expect(button.getAttribute('data-variant')).toBe('secondary');
    }
  });

  it.each(OVERRIDES)(
    '%s outranks the base rules it overrides, so stylesheet order never decides',
    async (family, bases) => {
      const root = await compiledSiteStylesheet();
      const familyRules = inLayer(rulesWithResolvedSelector(root, family));
      expect(familyRules.length, family).toBeGreaterThan(0);
      for (const base of bases) {
        expect(inLayer(rulesWithResolvedSelector(root, base)).length, base).toBeGreaterThan(0);
        expect(specificity(family), `${family} against ${base}`).toBeGreaterThan(specificity(base));
      }
    },
  );

  it('keeps a disabled receipt button on GrayText under forced colors', async () => {
    const root = await compiledSiteStylesheet();
    const forced = rulesWithResolvedSelector(root, '.shell-receipt-button[aria-disabled="true"]');
    expect(forced.map((rule) => declValue(rule, 'color')?.toLowerCase())).toContain('graytext');
  });
});
