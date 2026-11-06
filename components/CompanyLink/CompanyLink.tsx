import { companyLinkCopy } from '@/content/company-link';
import type { SiteLocale } from '@/content/site-locale';

const EXTERNAL_TARGET = '_blank';
const EXTERNAL_REL = 'noopener noreferrer';
const BASE_CLASS = 'company-link';

type CompanyLinkProps = {
  href: string;
  locale: SiteLocale;
  className?: string;
  describedBy?: string;
  children: React.ReactNode;
};

export function CompanyLink({ href, locale, className, describedBy, children }: CompanyLinkProps) {
  return (
    <a
      className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}
      href={href}
      target={EXTERNAL_TARGET}
      rel={EXTERNAL_REL}
      aria-describedby={describedBy}
    >
      {children}
      {describedBy ? null : <span className="sr-only"> {companyLinkCopy[locale].disclosure}</span>}
    </a>
  );
}

type CompanyMentionProps = {
  text: string;
  company: string;
  href: string;
  locale: SiteLocale;
};

export function CompanyMention({ text, company, href, locale }: CompanyMentionProps) {
  const at = text.indexOf(company);
  if (at < 0) {
    throw new Error(`CompanyMention: "${text}" does not name "${company}"`);
  }
  return (
    <>
      {text.slice(0, at)}
      <CompanyLink href={href} locale={locale}>
        {company}
      </CompanyLink>
      {text.slice(at + company.length)}
    </>
  );
}
