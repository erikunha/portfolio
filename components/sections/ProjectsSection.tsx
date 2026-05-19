import { headers } from 'next/headers';
import { projects } from '@/content/projects';
import { detectMobileFromUA } from '@/lib/breakpoint';
import { IconProjects } from '../Icons';
import { Module } from '../responsive/Module';

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 7l3-3h5l2 3h8v13H3z" />
  </svg>
);

// Async RSC: renders only the matching viewport branch server-side.
// Same UA-detection pattern as Module.tsx — avoids shipping both desktop
// and mobile card DOM trees when only one is visible at a time.
// Trade-off: a desktop browser resized to mobile width retains the desktop
// card layout (CSS layout media queries still apply). This is accepted — the
// same trade-off is already made by Module.tsx for the section shell.
export async function ProjectsSection({ defer }: { defer?: boolean } = {}) {
  const ua = (await headers()).get('user-agent');
  const isMobile = detectMobileFromUA(ua);

  return (
    <Module
      id="sec-projects"
      header="LS -LA ./PROJECTS"
      mobileHeader="LS -LA ~/PROJECTS"
      icon={<IconProjects />}
      defer={defer}
    >
      {isMobile ? (
        /* Mobile card layout */
        <div className="proj-mobile">
          {projects.map((p) => (
            <div key={p.name} className="proj">
              <div className="proj-top">
                <span className="proj-folder">
                  <FolderIcon />
                </span>
                <span className="proj-perm">{p.perm ?? '-rwxr-xr-x'}</span>
              </div>
              <div className="proj-name">{p.mobileName}</div>
              <div className="proj-desc">{p.mobileDescription}</div>
              <div className="proj-meta">
                {p.mobileMeta.map((m) => (
                  <div key={m.label} className="mrow">
                    <span className="mk">{m.label}</span>
                    <span className="mv">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop card layout */
        <ul className="projects proj-desktop">
          {projects.map((p) => (
            <li key={p.name} className="project">
              <div className="project__top">
                <svg className="project__folder" viewBox="0 0 24 18" aria-hidden="true">
                  <path d="M0 2 L0 18 L24 18 L24 5 L12 5 L9 2 Z" />
                </svg>
                <span className="project__perm">{p.perm ?? 'drwxr-xr-x'}</span>
              </div>
              <h3 className="project__name">{p.name}</h3>
              <p className="project__desc">{p.description}</p>
              <dl className="project__stats">
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
      )}
    </Module>
  );
}
