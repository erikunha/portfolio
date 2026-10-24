import { projectAnchor, projectSectionCopy, projects } from '@/content/projects';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconProjects } from '../../Icons';
import { Module } from '../../responsive/Module';
import { PerfReceiptsSection } from '../PerfReceiptsSection/PerfReceiptsSection';

export function ProjectsContent() {
  const lastProject = projects.at(-1);
  return (
    <ul className="projects-grid" data-testid="proj-desktop">
      {projects.map((project) => (
        <li
          id={projectAnchor(project.id)}
          key={project.id}
          className={`project-card${project === lastProject ? ' project-card-last' : ''}`}
        >
          <div className="project-meta">
            <svg
              className="project-folder"
              viewBox="0 0 24 18"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M0 2 L0 18 L24 18 L24 5 L12 5 L9 2 Z" />
            </svg>
            <div className="project-context">
              <span className="project-co">@ {project.company}</span>
              <span className="project-perm" aria-hidden="true">
                {project.perm}
              </span>
            </div>
          </div>
          <h3 className="project-name">
            {project.href ? (
              <a
                className="project-link"
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {project.name}
                <span className="sr-only">{projectSectionCopy.newTabDisclosure}</span>
              </a>
            ) : (
              project.name
            )}
          </h3>
          <p className="project-desc">{project.description}</p>
          <dl className="project-stats">
            {project.stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}:</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
            <div>
              <dt>{projectSectionCopy.stackLabel}:</dt>
              <dd>{project.stack.join(' / ')}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function ProjectsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-projects"
      header={projectSectionCopy.header}
      variant="green"
      mobileHeader={projectSectionCopy.mobileHeader}
      srLabel={SECTION_LABELS['sec-projects']}
      icon={<IconProjects />}
      defer={defer}
    >
      <ProjectsContent />
      <PerfReceiptsSection attached />
    </Module>
  );
}
