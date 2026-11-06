import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { companyLinkCopy } from '@/content/company-link';
import { SITE_LOCALE } from '@/content/site-locale';
import { CompanyLink, CompanyMention } from './CompanyLink';

const HREF = 'https://raylu.ai';

describe('CompanyLink', () => {
  it('opens the company site in a new tab without leaking the opener', () => {
    const { container } = render(
      <CompanyLink href={HREF} locale={SITE_LOCALE.en}>
        Raylu
      </CompanyLink>,
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe(HREF);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('names the company and discloses the new tab to assistive technology', () => {
    const { container } = render(
      <CompanyLink href={HREF} locale={SITE_LOCALE.en}>
        Raylu
      </CompanyLink>,
    );
    const link = container.querySelector('a');
    expect(link?.textContent).toBe(`Raylu ${companyLinkCopy[SITE_LOCALE.en].disclosure}`);
    expect(link?.querySelector('.sr-only')?.textContent).toBe(
      ` ${companyLinkCopy[SITE_LOCALE.en].disclosure}`,
    );
  });

  it('carries the shared class that supplies underline, focus ring and the hit area', () => {
    const { container } = render(
      <CompanyLink href={HREF} locale={SITE_LOCALE.en} className="extra">
        Raylu
      </CompanyLink>,
    );
    const link = container.querySelector('a');
    expect(link?.classList.contains('company-link')).toBe(true);
    expect(link?.classList.contains('extra')).toBe(true);
  });
});

describe('CompanyLink inside a type-reveal heading', () => {
  it('points at a description elsewhere instead of carrying its own sr-only text', () => {
    const { container } = render(
      <CompanyLink href={HREF} locale={SITE_LOCALE.en} describedBy="note">
        Raylu
      </CompanyLink>,
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('aria-describedby')).toBe('note');
    expect(link?.textContent).toBe('Raylu');
    expect(link?.querySelector('.sr-only')).toBeNull();
  });

  it('adds no aria-describedby when the disclosure is inline', () => {
    const { container } = render(
      <CompanyLink href={HREF} locale={SITE_LOCALE.en}>
        Raylu
      </CompanyLink>,
    );
    expect(container.querySelector('a')?.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('CompanyLink locale', () => {
  it('discloses the new tab in Portuguese on a Portuguese page', () => {
    const { container } = render(
      <CompanyLink href={HREF} locale={SITE_LOCALE.pt}>
        Raylu
      </CompanyLink>,
    );
    expect(container.querySelector('a')?.textContent).toBe('Raylu (abre em uma nova guia)');
  });

  it('discloses the new tab in Portuguese inside a mention', () => {
    const { container } = render(
      <p>
        <CompanyMention text="Raylu, NY" company="Raylu" href={HREF} locale={SITE_LOCALE.pt} />
      </p>,
    );
    expect(container.querySelector('p')?.textContent).toBe('Raylu (abre em uma nova guia), NY');
  });
});

describe('CompanyMention', () => {
  it('links only the company name inside a sentence and keeps the rest as text', () => {
    const { container } = render(
      <p>
        <CompanyMention
          text="Brazil · remote (Raylu, New York)"
          company="Raylu"
          href={HREF}
          locale={SITE_LOCALE.en}
        />
      </p>,
    );
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(HREF);
    expect(container.querySelector('p')?.textContent).toBe(
      `Brazil · remote (Raylu ${companyLinkCopy[SITE_LOCALE.en].disclosure}, New York)`,
    );
  });

  it('links the first occurrence only', () => {
    const { container } = render(
      <p>
        <CompanyMention
          text="Raylu and Raylu"
          company="Raylu"
          href={HREF}
          locale={SITE_LOCALE.en}
        />
      </p>,
    );
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('throws when the sentence no longer names the company, so copy drift cannot unlink it silently', () => {
    expect(() =>
      render(
        <CompanyMention
          text="Brazil · remote"
          company="Raylu"
          href={HREF}
          locale={SITE_LOCALE.en}
        />,
      ),
    ).toThrow(/Raylu/);
  });
});
