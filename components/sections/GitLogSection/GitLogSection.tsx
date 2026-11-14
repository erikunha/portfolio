import { useId } from 'react';
import { careerCopy, careerEntries } from '@/content/git-log';
import type { SiteLocale } from '@/content/site-locale';
import { deferProps } from '@/lib/defer-props';
import { CommandText } from '../../CommandText';
import { CompanyLink } from '../../CompanyLink';
import { IconGitLog } from '../../Icons';
import { CredentialsSection } from '../CredentialsSection';

const CAREER_LOG_TEST_ID = 'career-log';

export function GitLogContent({ locale }: { locale: SiteLocale }) {
  const copy = careerCopy[locale];
  return (
    <div className="career-log" data-testid={CAREER_LOG_TEST_ID}>
      <p className="career-command">
        <span>{copy.prompt}</span> <CommandText>{copy.command}</CommandText>
      </p>
      <ol className="career-commits">
        {careerEntries(locale).map((entry) => (
          <li key={entry.hash}>
            <span className="career-graph" aria-hidden="true">
              {copy.graph}
            </span>
            <p className="career-head">
              <span className="career-hash" aria-hidden="true">
                {entry.shortHash}
              </span>{' '}
              <span className="career-decoration" aria-hidden="true">
                {entry.deco}
              </span>{' '}
              <strong className="career-company">
                <CompanyLink href={entry.companyUrl} locale={locale}>
                  {entry.displayBrand}
                </CompanyLink>
                {entry.displayDetail}
              </strong>{' '}
              <strong className="career-role">{entry.displayRole}</strong>{' '}
              <span className="career-location">
                <span className="career-place">{entry.displayPlace}</span>
                {entry.displayMode !== null && (
                  <>
                    {' '}
                    <span className="career-mode">{entry.displayMode}</span>
                  </>
                )}
              </span>{' '}
              <span className="career-period">{entry.date}</span>
            </p>
            <p className="career-body">{entry.body.join(' ')}</p>
            <span className="career-graph-gap" aria-hidden="true">
              {copy.pipe}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GitLogSection({ locale, defer }: { locale: SiteLocale; defer?: boolean }) {
  const headingId = useId();
  const copy = careerCopy[locale];
  return (
    <section
      id="sec-git-log"
      tabIndex={-1}
      aria-labelledby={headingId}
      {...deferProps(defer, 'career-section')}
    >
      <header className="career-header">
        <h2 id={headingId}>
          <span data-type-reveal suppressHydrationWarning>
            {copy.heading}
          </span>
          <span className="career-icon" aria-hidden="true">
            <IconGitLog />
          </span>
          <span className="career-header-command" aria-hidden="true">
            {copy.headerCommand}
          </span>
          <span className="career-header-command-mobile" aria-hidden="true">
            <CommandText>{copy.mobileHeaderCommand}</CommandText>
          </span>
        </h2>
      </header>
      <div className="module-body-content">
        <GitLogContent locale={locale} />
        <CredentialsSection id="sec-credentials" communityId="sec-community" locale={locale} />
        <a className="career-cv" href={copy.cvHref}>
          {copy.cvLabel}
        </a>
      </div>
    </section>
  );
}
