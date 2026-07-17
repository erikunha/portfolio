import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getThemeColors } from '../../app/design-system/_lib/theme-tokens';

const DOCS = [
  'CLAUDE.md',
  'ARCHITECTURE.md',
  'STANDARDS.md',
  'app/design-system/page.mdx',
  'app/design-system/tokens/page.mdx',
  'app/design-system/components/page.mdx',
  'app/design-system/enforcement/page.mdx',
];

const STYLESHEETS = ['app/css/theme.css', 'app/css/base.css', 'app/css/components.css'];

const FONT_SOURCE = 'app/layout.tsx';

const NAMESPACED_TOKEN_IN_BACKTICKS = /`(--(?:color|font)-[\w-]+)`/g;

const CUSTOM_PROPERTY_DECLARATION = /(--[\w-]+)\s*:/g;

const FONT_VARIABLE_DECLARATION = /variable:\s*'(--[\w-]+)'/g;

const RETIRED_TOKEN_NAMES = ['--signal', '--fg', '--color-signal', '--color-text-body'];

const SIGNAL_HEX = '#00ff41';

const BODY_HEX = '#e6ffe6';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

const declaredCustomProperties = (): Set<string> => {
  const declared = new Set<string>();
  for (const sheet of STYLESHEETS) {
    for (const [, name] of read(sheet).matchAll(CUSTOM_PROPERTY_DECLARATION)) {
      if (name) declared.add(name);
    }
  }
  for (const [, name] of read(FONT_SOURCE).matchAll(FONT_VARIABLE_DECLARATION)) {
    if (name) declared.add(name);
  }
  return declared;
};

describe('the design tokens the docs name are the ones the code declares', () => {
  const declared = declaredCustomProperties();

  it('the declaration sweep actually found tokens', () => {
    expect(
      declared.size,
      'the sweep found no custom properties at all, so the regex or the file list has drifted and every assertion below is passing vacuously',
    ).toBeGreaterThan(20);
  });

  it.each(DOCS)('%s names no --color-*/--font-* token the code does not declare', (doc) => {
    const referenced = [...read(doc).matchAll(NAMESPACED_TOKEN_IN_BACKTICKS)].map(
      ([, token]) => token as string,
    );
    const phantom = [...new Set(referenced)].filter((token) => !declared.has(token));

    expect(
      phantom,
      `${doc} names these tokens in backticks, but nothing in ${STYLESHEETS.join(', ')} or ${FONT_SOURCE} declares them. CLAUDE.md loads into every session, so a phantom token name teaches every future agent a design system the codebase does not have.`,
    ).toEqual([]);
  });

  it.each(DOCS)('%s does not resurrect a retired token name', (doc) => {
    const source = read(doc);
    const resurrected = RETIRED_TOKEN_NAMES.filter((token) => source.includes(`\`${token}\``));

    expect(
      resurrected,
      `${doc} names a retired token. These four were the DOCUMENTED palette across CLAUDE.md, ARCHITECTURE.md and STANDARDS.md, and none of them ever existed as a custom property — three different fictional naming schemes for one real palette. The namespace check above cannot catch --signal or --fg (no --color-/--font- prefix to key on), so they are pinned by name here. The real tokens are --color-primary-500 (${SIGNAL_HEX}) and --color-tertiary-50 (${BODY_HEX}).`,
    ).toEqual([]);
  });

  it('the palette the docs document is the palette theme.css ships', () => {
    const colors = getThemeColors();
    expect(colors['primary-500']).toBe(SIGNAL_HEX);
    expect(colors['tertiary-50']).toBe(BODY_HEX);
  });
});
