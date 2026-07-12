import { readdirSync, readFileSync } from 'node:fs';
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

  it('contains no [open] attribute selector or ::details-content pseudo-element on a .module-* rule', () => {
    const ruleSelectors = Array.from(componentsCss.matchAll(/([^{}]+)\{[^{}]*\}/g))
      .map((match) => match[1])
      .filter((selector): selector is string => selector != null);
    const moduleOpenSelector = ruleSelectors.find(
      (selector) => selector.includes('.module') && selector.includes('[open]'),
    );
    const moduleDetailsContentSelector = ruleSelectors.find(
      (selector) => selector.includes('.module') && selector.includes('::details-content'),
    );
    expect(
      moduleOpenSelector,
      'app/css/components.css: found a `.module-*` selector combined with a `[open]` attribute ' +
        'selector. Module sections were migrated from <details open> to <section>, which can ' +
        'never match `[open]`. A rule gated on it either does nothing (dead CSS) or, worse, was ' +
        'meant to restore visibility that a collapsed base state removed - and now silently ' +
        'fails to, leaving section bodies invisible.',
    ).toBeUndefined();
    expect(
      moduleDetailsContentSelector,
      'app/css/components.css: found a `.module-*` selector combined with a `::details-content` ' +
        'pseudo-element. Module sections were migrated from <details open> to <section>, which ' +
        'can never match `::details-content`. A rule gated on it either does nothing (dead CSS) ' +
        'or, worse, was meant to restore visibility that a collapsed base state removed - and ' +
        'now silently fails to, leaving section bodies invisible.',
    ).toBeUndefined();
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

const DISCLOSURE_SCAN_ROOT_DIRS = ['components', 'app', 'lib', 'design-system'];
const DISCLOSURE_SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mdx']);
const DISCLOSURE_SCAN_SKIP_DIRS = new Set(['node_modules', '.next', '__tests__']);
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

function collectDisclosureScanFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (DISCLOSURE_SCAN_SKIP_DIRS.has(entry.name)) return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectDisclosureScanFiles(fullPath);
    if (TEST_FILE.test(entry.name)) return [];
    return DISCLOSURE_SCAN_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const CSS_EXTENSION = '.css';

const DISCLOSURE_PATTERNS: Array<{ name: string; pattern: RegExp; cssOnly?: true }> = [
  { name: '<details', pattern: /<details[\s>]/i },
  { name: '</details>', pattern: /<\/details>/i },
  { name: '<summary', pattern: /<summary[\s>]/i },
  { name: '</summary>', pattern: /<\/summary>/i },
  { name: 'HTMLDetailsElement', pattern: /HTMLDetailsElement/ },
  { name: '::details-content', pattern: /::details-content/ },
  { name: '[open] attribute selector', pattern: /\[open\]/, cssOnly: true },
  { name: "'[open]' selector string", pattern: /['"`][^'"`\n]*\[open\]/ },
  { name: "createElement('details')", pattern: /createElement\(\s*['"`]details['"`]/i },
];

describe('disclosure machinery: <details>/<summary> never returns to shipped source', () => {
  it('finds none of details/summary/HTMLDetailsElement/::details-content/[open] under components, app, lib, design-system', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const files = DISCLOSURE_SCAN_ROOT_DIRS.flatMap((dir) =>
      collectDisclosureScanFiles(path.join(repoRoot, dir)),
    );
    const violations: string[] = [];
    for (const file of files) {
      // behavioral-test-allow: no compiler or lint rule bans a deleted HTML element from
      // silently returning to shipped source
      const contents = readFileSync(file, 'utf-8');
      const isCss = path.extname(file) === CSS_EXTENSION;
      for (const { name, pattern, cssOnly } of DISCLOSURE_PATTERNS) {
        if (cssOnly && !isCss) continue;
        if (pattern.test(contents)) {
          violations.push(`${path.relative(repoRoot, file)}: ${name}`);
        }
      }
    }
    expect(
      violations,
      '<details>/<summary>/[open]/::details-content/HTMLDetailsElement was deliberately removed ' +
        'from this codebase (owner decision, see DECISIONS.md) and must stay removed. ' +
        'Reintroducing any of it lets a section collapse again - and any CSS still gated on an ' +
        '[open] attribute selector silently does nothing on a plain <section> element, which is ' +
        "how the whole site's content once got blanked with no build error and no console " +
        `warning. Offending files:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
