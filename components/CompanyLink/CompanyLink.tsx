import { companyLinkCopy } from '@/content/company-link';

const EXTERNAL_TARGET = '_blank';
const EXTERNAL_REL = 'noopener noreferrer';
const BASE_CLASS = 'company-link';

type CompanyLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function CompanyLink({ href, className, children }: CompanyLinkProps) {
  return (
    <a
      className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}
      href={href}
      target={EXTERNAL_TARGET}
      rel={EXTERNAL_REL}
    >
      {children}
      <span className="sr-only"> {companyLinkCopy.disclosure}</span>
    </a>
  );
}

type CompanyMentionProps = {
  text: string;
  company: string;
  href: string;
};

export function CompanyMention({ text, company, href }: CompanyMentionProps) {
  const at = text.indexOf(company);
  if (at < 0) {
    throw new Error(`CompanyMention: "${text}" does not name "${company}"`);
  }
  return (
    <>
      {text.slice(0, at)}
      <CompanyLink href={href}>{company}</CompanyLink>
      {text.slice(at + company.length)}
    </>
  );
}
