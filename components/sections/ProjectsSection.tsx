import { Suspense } from 'react';
import { projects } from '@/content/projects';
import { getIsMobile } from '@/lib/ua';
import { IconProjects } from '../Icons';
import { Module } from '../responsive/Module';
import styles from './ProjectsSection.module.css';

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 7l3-3h5l2 3h8v13H3z" />
  </svg>
);

function ProjectsDesktop() {
  return (
    <ul className={styles.root} data-testid="proj-desktop">
      {projects.map((p) => (
        <li key={p.name} className={styles.project}>
          <div className={styles.projectTop}>
            <svg className={styles.projectFolder} viewBox="0 0 24 18" aria-hidden="true">
              <path d="M0 2 L0 18 L24 18 L24 5 L12 5 L9 2 Z" />
            </svg>
            <span className={styles.projectPerm}>{p.perm ?? 'drwxr-xr-x'}</span>
          </div>
          <h3 className={styles.projectName}>{p.name}</h3>
          <p className={styles.projectDesc}>{p.description}</p>
          <dl className={styles.projectStats}>
            {p.stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}:</dt>
                <dd>{s.value}</dd>
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
      {projects.map((p) => (
        <div key={p.name} className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardFolder}>
              <FolderIcon />
            </span>
            <span className={styles.cardPerm}>{p.perm ?? '-rwxr-xr-x'}</span>
          </div>
          <div className={styles.cardName}>{p.mobileName}</div>
          <div className={styles.cardDesc}>{p.mobileDescription}</div>
          <div className={styles.cardMeta}>
            {p.mobileMeta.map((m) => (
              <div key={m.label} className={styles.mrow}>
                <span className={styles.mk}>{m.label}</span>
                <span className={styles.mv}>{m.value}</span>
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
