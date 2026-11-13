import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';

const stylesheet = parse(readComponentsCss());
const NO_SCRIPT_MEDIA = /^\(scripting:\s*none\)$/;
const HIDDEN = 'none';

function noScriptRules() {
  const rules: Array<{ selector: string; display: string | undefined; layer: string }> = [];
  stylesheet.walkAtRules('media', (media) => {
    if (!NO_SCRIPT_MEDIA.test(media.params.trim())) return;
    const layer = (media.parent as { name?: string; params?: string } | undefined)?.params ?? '';
    media.walkRules((rule) => {
      let display: string | undefined;
      rule.walkDecls('display', (decl) => {
        display = decl.value.replace(/\s*!important$/, '');
      });
      rules.push({ selector: rule.selector, display, layer });
    });
  });
  return rules;
}

describe('controls that need JavaScript', () => {
  const generic = noScriptRules().find(
    (rule) => rule.selector.startsWith('button:not(') && rule.display === HIDDEN,
  );

  it('are hidden by one rule over every button that is not a form submit', () => {
    expect(
      generic,
      'a button with scripting off does nothing, so one generic rule must hide it on every route',
    ).toBeDefined();
    expect(generic?.selector).toContain('[type="submit"]');
    expect(generic?.selector).toContain('[type="reset"]');
  });

  it('sit in the utilities layer so no component rule can draw them again', () => {
    expect(generic?.layer).toBe('utilities');
  });
});
