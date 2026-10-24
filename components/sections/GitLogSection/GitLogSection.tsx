import { careerCommand, careerCvHref, gitLog } from '@/content/git-log';
import { moduleHeaderId } from '../../responsive/Module/module.constants';
import { CommunitySection } from '../CommunitySection';
import { CredentialsSection } from '../CredentialsSection';
import { EducationSection } from '../EducationSection';

const HASH_LENGTH = 7;
const EMPLOYMENT_RANGE_SEPARATOR = ' - ';

export function GitLogContent() {
  return (
    <>
      <p className="career-command" aria-hidden="true">
        <span>erik@portfolio:~$</span> {careerCommand}
      </p>
      <ol className="career-log" aria-label="Employment history">
        {gitLog.map((commit) => {
          const [startLabel, endLabel] = commit.date.split(EMPLOYMENT_RANGE_SEPARATOR);
          return (
            <li key={commit.hash} className="career-commit">
              <span className="career-graph" aria-hidden="true">
                <span className="career-star">*</span>
                <span className="career-rail">|</span>
              </span>
              <div className="career-commit-heading">
                <span className="career-hash" aria-hidden="true">
                  {commit.hash.slice(0, HASH_LENGTH)}{' '}
                </span>
                <span className="career-refs" aria-hidden="true">
                  {commit.deco}{' '}
                </span>
                <h3 className="career-company">{commit.company}</h3>{' '}
                <span className="career-role">{commit.role}</span>{' '}
                <span className="career-location">
                  {commit.location}
                  {commit.workMode ? ` (${commit.workMode})` : ''}
                </span>{' '}
                <span className="career-period">
                  <time dateTime={commit.startMonth}>{startLabel}</time>
                  {EMPLOYMENT_RANGE_SEPARATOR}
                  {commit.endMonth ? <time dateTime={commit.endMonth}>{endLabel}</time> : endLabel}
                </span>
              </div>
              <p className="career-description">{commit.body.join(' ')}</p>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function GitLogSection({ defer = false }: { defer?: boolean } = {}) {
  return (
    <section
      id="sec-git-log"
      aria-labelledby="sec-git-log-header"
      tabIndex={-1}
      className={`career-section${defer ? ' module-deferred' : ''}`}
      {...(defer ? { 'data-cv-defer': 'true' } : {})}
    >
      <h2 id={moduleHeaderId('sec-git-log')} className="career-title">
        Career
        <span className="career-title-command" aria-hidden="true">
          GIT LOG --ONELINE --DECORATE --GRAPH
        </span>
      </h2>
      <div className="career-body">
        <GitLogContent />
        <div className="career-groups">
          <CredentialsSection embedded />
          <EducationSection />
          <CommunitySection embedded />
        </div>
        <a href={careerCvHref} className="career-cv-link">
          View CV
        </a>
      </div>
    </section>
  );
}
