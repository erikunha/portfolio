import { Suspense, useId } from 'react';
import { careerCopy, careerEntries, careerScrollLabel } from '@/content/git-log';
import { getIsMobile } from '@/lib/ua';
import { IconGitLog } from '../../Icons';
import { CredentialsSection } from '../CredentialsSection';

function GitLogRail({ isMobile = false }: { isMobile?: boolean }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: this names the keyboard-readable log, not form controls
    <div
      className="career-log"
      data-testid={isMobile ? 'career-mobile' : 'career-desktop'}
      role="group"
      aria-label={careerScrollLabel}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: retain keyboard access to the career log
      tabIndex={0}
    >
      <p className="career-command">
        <span>{careerCopy.prompt}</span> {careerCopy.command}
      </p>
      <ol className="career-commits">
        {careerEntries.map((entry) => (
          <li key={entry.hash}>
            <span className="career-graph" aria-hidden="true">
              {careerCopy.graph}
            </span>
            <p className="career-head">
              <span className="career-hash" aria-hidden="true">
                {entry.shortHash}
              </span>{' '}
              <span className="career-decoration" aria-hidden="true">
                {entry.deco}
              </span>{' '}
              <strong className="career-company">{entry.displayCompany}</strong>{' '}
              <strong>{entry.displayRole}</strong>{' '}
              <span className="career-location">{entry.displayLocation}</span>{' '}
              <span className="career-period">{entry.date}</span>
            </p>
            <p className="career-body">{entry.body.join(' ')}</p>
            <span className="career-graph-gap" aria-hidden="true">
              {careerCopy.pipe}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export async function GitLogContent() {
  return <GitLogRail isMobile={await getIsMobile()} />;
}

export function GitLogSection({ defer }: { defer?: boolean } = {}) {
  const headingId = useId();
  return (
    <section
      id="sec-git-log"
      tabIndex={-1}
      aria-labelledby={headingId}
      className={`career-section${defer ? ' module-deferred' : ''}`}
      {...(defer ? { 'data-cv-defer': 'true' } : {})}
    >
      <header className="career-header">
        <h2 id={headingId}>
          <span>{careerCopy.heading}</span>
          <span className="career-icon" aria-hidden="true">
            <IconGitLog />
          </span>
          <span className="career-header-command" aria-hidden="true">
            {careerCopy.headerCommand}
          </span>
          <span className="career-header-command-mobile" aria-hidden="true">
            {careerCopy.mobileHeaderCommand}
          </span>
        </h2>
      </header>
      <div className="module-body-content">
        <Suspense fallback={<GitLogRail />}>
          <GitLogContent />
        </Suspense>
        <CredentialsSection id="sec-credentials" communityId="sec-community" />
        <a className="career-cv" href={careerCopy.cvHref}>
          {careerCopy.cvLabel}
        </a>
      </div>
    </section>
  );
}
