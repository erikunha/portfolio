import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate CSS cascade/media-query resolution
const componentsCss = readFileSync(path.resolve(__dirname, '../app/css/components.css'), 'utf-8');

describe('module-body-content: section-body collapse trap (details -> section refactor)', () => {
  it('never defaults any .module-body-content rule block to opacity: 0', () => {
    const rules = Array.from(componentsCss.matchAll(/\.module-body-content[^{]*\{[^}]*\}/g));
    expect(
      rules.length > 0,
      'app/css/components.css: expected to find at least one .module-body-content rule block.',
    ).toBe(true);
    const opacityZeroBlock = rules.find((match) => /opacity:\s*0(?![.\d])/.test(match[0]));
    expect(
      opacityZeroBlock,
      'app/css/components.css: no .module-body-content rule block (base, media-query, or ' +
        'variant-qualified) must ever default to opacity: 0. ' +
        'Section bodies are plain <section> elements now (no [open] toggle re-reveals them) ' +
        '- a bare `opacity: 0` on ANY of these blocks makes section bodies permanently invisible, ' +
        'with no build error and no console warning.',
    ).toBeUndefined();
  });

  it('contains no [open] attribute selector or ::details-content pseudo-element', () => {
    const hasOpenSelector = /\[open\]/.test(componentsCss);
    const hasDetailsContentPseudo = /::details-content/.test(componentsCss);
    expect(
      hasOpenSelector || hasDetailsContentPseudo,
      'app/css/components.css: found a `[open]` attribute selector or `::details-content` ' +
        'pseudo-element. Module sections were migrated from <details open> to <section>, which ' +
        'can never match either selector. A rule gated on them either does nothing (dead CSS) or, ' +
        'worse, was meant to restore visibility that a collapsed base state removed - and now ' +
        'silently fails to, leaving section bodies invisible.',
    ).toBe(false);
  });

  it('keeps the desktop border on .module-body-content under the >= 769px media query', () => {
    const desktopBlockMatch = componentsCss.match(
      /@media \(min-width:\s*769px\)\s*\{([\s\S]*?)\n {2}\}/,
    );
    const desktopBlock = desktopBlockMatch?.[1] ?? '';
    const desktopRuleMatch = desktopBlock.match(/\.module-body-content\s*\{[^}]*\}/);
    const hasBorder = !!desktopRuleMatch && /border\s*:/.test(desktopRuleMatch[0]);
    expect(
      hasBorder,
      'app/css/components.css: the `@media (min-width: 769px)` block must still declare a ' +
        '`border` on .module-body-content. This declaration previously lived only inside an ' +
        '[open]-qualified rule during the <details> era, making it the value most likely to be ' +
        'dropped by a future edit that touches this block.',
    ).toBe(true);
  });
});
