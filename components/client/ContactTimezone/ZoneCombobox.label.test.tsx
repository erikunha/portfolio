import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { ZoneCombobox } from './ZoneCombobox';

const NOW = new Date('2026-01-15T15:00:00Z');

describe.each(Object.values(SITE_LOCALE))('ZoneCombobox label (%s)', (locale) => {
  const { timezone: copy } = contactCopy[locale];

  function renderCombobox() {
    render(<ZoneCombobox copy={copy} now={NOW} onSelect={() => undefined} />);
    return screen.getByRole('combobox');
  }

  it('shows a visible label that stays on screen while the field has text', () => {
    const field = renderCombobox();
    const label = document.querySelector(`label[for="${field.id}"]`);
    expect(
      label?.textContent,
      'WCAG 3.3.2: a placeholder disappears as soon as the visitor types',
    ).toBe(copy.search.label);
  });

  it('takes its accessible name from that visible label (WCAG 2.5.3)', () => {
    const field = renderCombobox();
    expect(field.hasAttribute('aria-label')).toBe(false);
    expect(screen.getByRole('combobox', { name: copy.search.label })).toBe(field);
  });

  it('keeps the placeholder as an example, never as the only label', () => {
    const field = renderCombobox();
    expect(field.getAttribute('placeholder')).toBe(copy.search.placeholder);
    expect(copy.search.placeholder).not.toBe(copy.search.label);
  });
});
