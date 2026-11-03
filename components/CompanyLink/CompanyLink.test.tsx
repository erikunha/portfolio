import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { companyLinkCopy } from '@/content/company-link';
import { CompanyLink, CompanyMention } from './CompanyLink';

const HREF = 'https://raylu.ai';

describe('CompanyLink', () => {
  it('opens the company site in a new tab without leaking the opener', () => {
    const { container } = render(<CompanyLink href={HREF}>Raylu</CompanyLink>);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe(HREF);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('names the company and discloses the new tab to assistive technology', () => {
    const { container } = render(<CompanyLink href={HREF}>Raylu</CompanyLink>);
    const link = container.querySelector('a');
    expect(link?.textContent).toBe(`Raylu ${companyLinkCopy.disclosure}`);
    expect(link?.querySelector('.sr-only')?.textContent).toBe(` ${companyLinkCopy.disclosure}`);
  });

  it('carries the shared class that supplies underline, focus ring and the 44px hit area', () => {
    const { container } = render(
      <CompanyLink href={HREF} className="extra">
        Raylu
      </CompanyLink>,
    );
    const link = container.querySelector('a');
    expect(link?.classList.contains('company-link')).toBe(true);
    expect(link?.classList.contains('extra')).toBe(true);
  });
});

describe('CompanyMention', () => {
  it('links only the company name inside a sentence and keeps the rest as text', () => {
    const { container } = render(
      <p>
        <CompanyMention text="Brazil · remote (Raylu, New York)" company="Raylu" href={HREF} />
      </p>,
    );
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(HREF);
    expect(container.querySelector('p')?.textContent).toBe(
      `Brazil · remote (Raylu ${companyLinkCopy.disclosure}, New York)`,
    );
  });

  it('links the first occurrence only', () => {
    const { container } = render(
      <p>
        <CompanyMention text="Raylu and Raylu" company="Raylu" href={HREF} />
      </p>,
    );
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('throws when the sentence no longer names the company, so copy drift cannot unlink it silently', () => {
    expect(() =>
      render(<CompanyMention text="Brazil · remote" company="Raylu" href={HREF} />),
    ).toThrow(/Raylu/);
  });
});
