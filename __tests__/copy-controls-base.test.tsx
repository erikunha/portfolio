import { render, screen } from '@testing-library/react';
import type { AtRule, Container, Document, Root, Rule } from 'postcss';
import { describe, expect, it, vi } from 'vitest';
import { CopyButton } from '@/app/(en)/design-system/_components/CopyButton';
import { ContactResult } from '@/components/client/ContactForm/ContactResult';
import { CONTACT_STATUS } from '@/components/client/ContactForm/useContactSubmit';
import { contactCopy } from '@/content/contact-copy';
import { serverErrorContent } from '@/content/server-error-detail';
import { SITE_LOCALE } from '@/content/site-locale';
import { compiledSiteStylesheet, declValue, rulesWithResolvedSelector } from './helpers/css-rules';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const { ServerErrorMain } = await import('@/components/ErrorPages/ErrorPages.client');

const copy = contactCopy[SITE_LOCALE.en];
const STAMPS = { rendered: '0.100', reported: '0.200' };
const DIGEST = '1234567890';
const LEGACY_CLASS = 'copy-btn';
const OWNED_BY_BASE_AND_VARIANT = [
  'background',
  'background-color',
  'border',
  'border-style',
  'border-width',
  'box-shadow',
  'cursor',
  'font-family',
  'font-size',
  'letter-spacing',
  'min-height',
  'min-width',
  'transition',
] as const;
const FORCED_COLORS = /forced-colors/;

function authoredRules(root: Root, selector: string): Rule[] {
  return rulesWithResolvedSelector(root, selector).filter((rule) => {
    let node: Container | Document | undefined = rule.parent;
    while (node) {
      if (node.type === 'atrule' && FORCED_COLORS.test((node as AtRule).params)) return false;
      node = node.parent;
    }
    return true;
  });
}

function declaredProperties(rules: Rule[]): string[] {
  return rules.flatMap((rule) =>
    rule.nodes.flatMap((node) => (node.type === 'decl' ? [node.prop] : [])),
  );
}

describe('copy controls markup', () => {
  it('renders the docs copy button as a quiet .btn', () => {
    render(<CopyButton text="pnpm install" />);
    const control = screen.getByRole('button', { name: 'COPY' });
    expect(control.classList.contains('btn')).toBe(true);
    expect(control.classList.contains(LEGACY_CLASS)).toBe(true);
    expect(control.getAttribute('data-variant')).toBe('quiet');
  });

  it('renders the error reference copy control as a quiet .btn', () => {
    const content = serverErrorContent[SITE_LOCALE.en];
    render(<ServerErrorMain retry={vi.fn()} content={content} stamps={STAMPS} digest={DIGEST} />);
    const control = screen.getByRole('button', { name: content.copyAriaLabel });
    expect(control.classList.contains('btn')).toBe(true);
    expect(control.getAttribute('data-variant')).toBe('quiet');
  });

  it('renders the contact dismiss as a secondary .btn without the shared copy class', () => {
    render(
      <ContactResult
        copy={copy}
        status={CONTACT_STATUS.SUCCESS}
        receipt={null}
        onDismiss={vi.fn()}
      />,
    );
    const control = screen.getByRole('button', { name: copy.dismiss.aria });
    expect(control.classList.contains('btn')).toBe(true);
    expect(control.classList.contains(LEGACY_CLASS)).toBe(false);
    expect(control.getAttribute('data-variant')).toBe('secondary');
  });
});

describe('copy controls stylesheet', () => {
  it('has no .copy-btn rule outside the base-qualified selectors', async () => {
    const root = await compiledSiteStylesheet();
    expect(authoredRules(root, '.copy-btn')).toEqual([]);
    expect(authoredRules(root, '.copy-btn:hover')).toEqual([]);
  });

  it('keeps only the 12px padding and the inherited line height on the shared hook', async () => {
    const root = await compiledSiteStylesheet();
    const rules = authoredRules(root, '.btn.copy-btn');
    expect(declaredProperties(rules)).toEqual(['--leading', 'padding-inline']);
    expect(declValue(rules[0], '--leading')).toBe('inherit');
    expect(declValue(rules[0], 'padding-inline')).toBe('var(--spacing-3)');
  });

  it('keeps only the error reference colors and inherited font above the quiet variant', async () => {
    const root = await compiledSiteStylesheet();
    const rules = authoredRules(root, '.err-ref .btn.copy-btn');
    expect(declaredProperties(rules).sort()).toEqual(['border-color', 'color', 'font']);
  });

  it('keeps the dismiss deltas and no base-owned property', async () => {
    const root = await compiledSiteStylesheet();
    const rules = authoredRules(root, '.btn.contact-dismiss[data-variant="secondary"]');
    const declared = declaredProperties(rules);
    expect(declared.sort()).toEqual([
      '--leading',
      'border-color',
      'font-weight',
      'padding-inline',
      'text-transform',
    ]);
    expect(declValue(rules[0], 'text-transform')).toBe('none');
    for (const property of OWNED_BY_BASE_AND_VARIANT) expect(declared).not.toContain(property);
    expect(authoredRules(root, '.contact-dismiss:hover')).toEqual([]);
  });
});
