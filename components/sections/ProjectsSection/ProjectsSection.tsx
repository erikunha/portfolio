import { Suspense } from 'react';
import { projects } from '@/content/projects';
import { getIsMobile } from '@/lib/ua';
import { IconProjects } from '../../Icons';
import { Module } from '../../responsive/Module';

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 7l3-3h5l2 3h8v13H3z" />
  </svg>
);

function ProjectsDesktop() {
  return (
    <ul
      className="projects-grid list-none m-0 p-0 grid grid-cols-1 md:grid-cols-3 gap-5"
      data-testid="proj-desktop"
    >
      {projects.map((p) => (
        <li
          key={p.name}
          className={[
            'project-card relative border border-primary-subtle p-5 md:p-5 flex flex-col',
            'transition-[border-color,box-shadow] duration-200',
            'hover:border-primary-500 hover:shadow-[0_0_16px_var(--color-glow-18)]',
            'motion-reduce:transition-none',
            '[body[data-motion=reduce]_&]:transition-none',
          ].join(' ')}
        >
          <div className="flex justify-between items-end mb-3">
            <svg className="w-10 h-8 fill-primary-500" viewBox="0 0 24 18" aria-hidden="true">
              <path d="M0 2 L0 18 L24 18 L24 5 L12 5 L9 2 Z" />
            </svg>
            <span className="text-primary-400 text-xs opacity-75 m-0">
              {p.perm ?? 'drwxr-xr-x'}
            </span>
          </div>
          <h3 className="project-name text-primary-500 font-bold text-sm max-md:text-xs md:text-base tracking-[0.04em] my-1.5">
            {p.name}
          </h3>
          <p className="project-desc text-tertiary-50 text-xs md:text-sm mb-4">{p.description}</p>
          <dl className="grid gap-1 text-xs md:text-sm m-0 mt-auto">
            {p.stats.map((s) => (
              <div key={s.label} className="flex justify-between gap-2">
                <dt className="text-secondary-200">{s.label}:</dt>
                <dd className="m-0 text-primary-400">{s.value}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function ProjectsMobile() {
  return (
    <div data-testid="proj-mobile">
      {projects.map((p, i) => (
        <div
          key={p.name}
          className={[
            'border border-primary-subtle p-3.5',
            i < projects.length - 1 ? 'mb-2.5' : '',
          ].join(' ')}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="w-8 h-[26px] [&_svg]:w-full [&_svg]:h-full [&_svg]:fill-primary-500">
              <FolderIcon />
            </span>
            <span className="text-primary-400 text-xs opacity-75 tracking-[0.04em]">
              {p.perm ?? '-rwxr-xr-x'}
            </span>
          </div>
          <div className="text-primary-500 font-bold text-xs tracking-[0.04em] my-1">
            {p.mobileName}
          </div>
          <div className="text-tertiary-50 text-xs mb-3 leading-[1.5]">{p.mobileDescription}</div>
          <div className="grid gap-[3px] text-xs">
            {p.mobileMeta.map((m) => (
              <div key={m.label} className="flex justify-between gap-2">
                <span className="text-secondary-200 shrink-0">{m.label}</span>
                <span className="text-primary-400 text-right">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export async function ProjectsContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <ProjectsMobile /> : <ProjectsDesktop />;
}

export function ProjectsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-projects"
      header="LS -LA ./PROJECTS"
      variant="green"
      mobileHeader="LS -LA ~/PROJECTS"
      icon={<IconProjects />}
      defer={defer}
    >
      <Suspense fallback={<ProjectsDesktop />}>
        <ProjectsContent />
      </Suspense>
    </Module>
  );
}
