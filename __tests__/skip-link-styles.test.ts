// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesInMedia,
  rulesWithResolvedSelector,
} from './helpers/css-rules';

const SKIP_LINKS = ['.skip-to-content', '.mixer-skip-link'] as const;
const PRINT = /print/;
const HIDDEN_CLIP = 'inset(50%)';
const REVEALED_CLIP = 'inset(0)';
const NO_DISPLAY = 'none';

describe.each(SKIP_LINKS)('%s styles', (selector) => {
  it('is clipped away until it takes focus', async () => {
    const root = await compiledSiteStylesheet();
    const resting = rulesWithResolvedSelector(root, selector).map((rule) =>
      declValue(rule, 'clip-path'),
    );
    expect(resting).toContain(HIDDEN_CLIP);
    const focused = rulesWithResolvedSelector(root, `${selector}:focus`).map((rule) =>
      declValue(rule, 'clip-path'),
    );
    expect(focused).toContain(REVEALED_CLIP);
  });

  it('does not print', async () => {
    const root = await compiledSiteStylesheet();
    const printed = rulesInMedia(root, PRINT, selector).map((rule) => declValue(rule, 'display'));
    expect(printed).toContain(NO_DISPLAY);
  });
});
