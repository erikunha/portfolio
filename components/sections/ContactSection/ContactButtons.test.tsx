import { render, screen } from '@testing-library/react';
import type { AtRule, Container, Document, Root, Rule } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesWithResolvedSelector,
} from '@/__tests__/helpers/css-rules';
import { ContactForm } from '@/components/client/ContactForm/ContactForm';
import { ProposeSlot } from '@/components/client/ContactTimezone/ProposeSlot.client';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactSection } from './ContactSection';

const copy = contactCopy[SITE_LOCALE.en];
const SLOT = { you: '14:00', erik: '10:00' };
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
const FORCED_COLORS = /forced-colors/;
const FAMILIES = ['.contact-send', '.contact-channel-cta', '.ctz-propose', '.contact-copy-btn'];

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

describe('contact buttons markup', () => {
  it('renders the LinkedIn call to action as a primary .btn', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection locale={SITE_LOCALE.en} />);
    const cta = host.querySelector('.contact-channel-cta');
    expect(cta?.classList.contains('btn')).toBe(true);
    expect(cta?.getAttribute('data-variant')).toBe('primary');
  });

  it('renders the copy control as a quiet .btn without the shared copy-btn class', () => {
    render(<ContactSection locale={SITE_LOCALE.en} />);
    const control = screen.getByRole('button', { name: copy.section.copyEmail });
    expect(control.classList.contains('btn')).toBe(true);
    expect(control.classList.contains('copy-btn')).toBe(false);
    expect(control.getAttribute('data-variant')).toBe('quiet');
  });

  it('renders the send control as a primary .btn', () => {
    render(<ContactForm copy={copy} chrome={contactChrome[SITE_LOCALE.en]} />);
    const send = screen.getByRole('button', { name: copy.form.submit });
    expect(send.classList.contains('btn')).toBe(true);
    expect(send.getAttribute('data-variant')).toBe('primary');
  });

  it('renders the timezone propose control as a primary .btn', () => {
    render(<ProposeSlot copy={copy.timezone} slot={SLOT} slotLine="Would a call work?" />);
    const propose = screen.getByRole('button', { name: copy.timezone.propose.label });
    expect(propose.classList.contains('btn')).toBe(true);
    expect(propose.getAttribute('data-variant')).toBe('primary');
  });
});

describe('contact buttons stylesheet', () => {
  it.each(FAMILIES)('%s leaves paint, border, font, cursor and motion to .btn', async (family) => {
    const root = await compiledSiteStylesheet();
    const declared = authoredRules(root, family).flatMap((rule) =>
      OWNED_BY_BASE_AND_VARIANT.filter((property) => declValue(rule, property) !== undefined),
    );
    expect(declared).toEqual([]);
  });

  it('paints the quiet variant and drops the glow on hover', async () => {
    const root = await compiledSiteStylesheet();
    const [rest] = rulesWithResolvedSelector(root, '.btn[data-variant="quiet"]');
    expect(declValue(rest, 'background-color')).toBe('transparent');
    expect(declValue(rest, 'color')).toBe('var(--color-text-secondary)');
    expect(declValue(rest, 'border-color')).toBe('var(--color-border)');
    const [hover] = rulesWithResolvedSelector(root, '.btn[data-variant="quiet"]:hover');
    expect(declValue(hover, 'color')).toBe('var(--color-accent)');
    expect(declValue(hover, 'box-shadow')).toBe('none');
  });

  it('keeps the busy send control undimmed, clickable for the wait cursor and unglowing', async () => {
    const root = await compiledSiteStylesheet();
    const [busy] = authoredRules(root, '.contact-send[aria-disabled="true"]');
    expect(declValue(busy, 'opacity')).toBe('1');
    expect(declValue(busy, 'pointer-events')).toBe('auto');
    expect(declValue(busy, 'cursor')).toBe('wait');
    const [hover] = authoredRules(root, '.contact-send[aria-disabled="true"]:hover');
    expect(declValue(hover, 'box-shadow')).toBe('none');
  });
});
