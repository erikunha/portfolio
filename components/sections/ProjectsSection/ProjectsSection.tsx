import { Fragment } from 'react';
import { ExternalLink } from '@/components/ExternalLink';
import { companyUrlFor } from '@/content/git-log';
import { projectPresentation, projects } from '@/content/projects';
import type { Project } from '@/content/schemas';
import { SECTION_LABELS } from '@/content/section-labels';
import type { SiteLocale } from '@/content/site-locale';
import { CompanyLink } from '../../CompanyLink';
import { IconProjects } from '../../Icons';
import { Module } from '../../responsive/Module';
import { PerfReceiptsSection } from '../PerfReceiptsSection';

const COMPANY_LABEL_PREFIX = '@ ';
const COMPANY_WORD_SEPARATOR = '_';

function CompanyLabel({
  kind,
  company,
  locale,
}: Pick<Project, 'kind' | 'company'> & { locale: SiteLocale }) {
  if (kind === 'oss') return null;
  const label = company.toUpperCase().replaceAll(' ', COMPANY_WORD_SEPARATOR);
  return (
    <>
      {COMPANY_LABEL_PREFIX}
      <CompanyLink href={companyUrlFor(company)} locale={locale}>
        {label}
      </CompanyLink>
    </>
  );
}

const NAME_SEPARATOR = '_';

function BreakAfterUnderscores({ text }: { text: string }) {
  const segments: { offset: number; part: string; last: boolean }[] = [];
  let offset = 0;
  const parts = text.split(NAME_SEPARATOR);
  for (const [position, part] of parts.entries()) {
    segments.push({ offset, part, last: position === parts.length - 1 });
    offset += part.length + NAME_SEPARATOR.length;
  }
  return segments.map(({ offset: start, part, last }) => (
    <Fragment key={start}>
      {part}
      {last ? null : (
        <>
          {NAME_SEPARATOR}
          <wbr />
        </>
      )}
    </Fragment>
  ));
}

export function ProjectsContent({ locale }: { locale: SiteLocale }) {
  const presentation = projectPresentation[locale];
  return (
    <ul className="projects-grid" data-testid="projects-grid">
      {projects[locale].map((project) => (
        <li key={project.name} className="project-card">
          <div className="project-meta">
            <svg className="project-folder" viewBox="0 0 24 18" aria-hidden="true">
              <path d="M0 2 L0 18 L24 18 L24 5 L12 5 L9 2 Z" />
            </svg>
            <span className="project-attribution">
              <span className="project-co">
                <CompanyLabel kind={project.kind} company={project.company} locale={locale} />
              </span>
              <span className="project-perm">{project.perm ?? presentation.permissions}</span>
            </span>
          </div>
          <h3 className="project-name">
            {project.url ? (
              <ExternalLink href={project.url}>
                <BreakAfterUnderscores text={project.name} />
                <span className="sr-only"> {presentation.externalDisclosure}</span>
              </ExternalLink>
            ) : (
              <BreakAfterUnderscores text={project.name} />
            )}
          </h3>
          <p className="project-desc">{project.description}</p>
          <dl className="project-stats">
            {project.stats.map((stat) => (
              <div key={stat.label} className="max-md:flex-col max-md:gap-0">
                <dt>{stat.label}:</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function ProjectsSection({ locale, defer }: { locale: SiteLocale; defer?: boolean }) {
  const presentation = projectPresentation[locale];
  return (
    <Module
      id="sec-projects"
      header={presentation.command}
      variant="green"
      mobileHeader={presentation.mobileCommand}
      name={SECTION_LABELS[locale]['sec-projects']}
      icon={<IconProjects />}
      defer={defer}
    >
      <ProjectsContent locale={locale} />
      <PerfReceiptsSection locale={locale} />
    </Module>
  );
}
