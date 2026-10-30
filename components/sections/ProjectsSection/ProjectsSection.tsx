import { projectPresentation, projects } from '@/content/projects';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconProjects } from '../../Icons';
import { Module } from '../../responsive/Module';
import { PerfReceiptsSection } from '../PerfReceiptsSection';

export function ProjectsContent() {
  return (
    <ul className="projects-grid" data-testid="proj-desktop">
      {projects.map((project) => (
        <li key={project.name} className="project-card">
          <div className="project-meta">
            <svg className="project-folder" viewBox="0 0 24 18" aria-hidden="true">
              <path d="M0 2 L0 18 L24 18 L24 5 L12 5 L9 2 Z" />
            </svg>
            <span className="project-attribution">
              <span className="project-co">@ {project.company}</span>
              <span className="project-perm">
                {project.perm ?? projectPresentation.permissions}
              </span>
            </span>
          </div>
          <h3 className="project-name" data-type-reveal>
            {project.url ? (
              <a href={project.url} target="_blank" rel="noopener noreferrer">
                {project.name}
                <span className="sr-only"> {projectPresentation.externalDisclosure}</span>
              </a>
            ) : (
              project.name
            )}
          </h3>
          <p className="project-desc">{project.description}</p>
          <dl className="project-stats">
            {project.stats.map((stat) => (
              <div key={stat.label} className="max-md:flex-col max-md:gap-0">
                <dt>{stat.label}:</dt>
                <dd className="max-md:text-left">{stat.value}</dd>
              </div>
            ))}
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
      header={projectPresentation.command}
      variant="green"
      mobileHeader={projectPresentation.mobileCommand}
      srLabel={SECTION_LABELS['sec-projects']}
      icon={<IconProjects />}
      defer={defer}
    >
      <ProjectsContent />
      <PerfReceiptsSection />
    </Module>
  );
}
