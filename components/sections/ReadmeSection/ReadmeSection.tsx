import { readmeCopy as c, readmeLineNumbers } from '@/content/readme';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconReadme } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ReadmeSection({ panel = false }: { panel?: boolean } = {}) {
  return (
    <Module
      id="sec-readme"
      header={c.desktopH1}
      srLabel={panel ? undefined : SECTION_LABELS['sec-readme']}
      icon={panel ? undefined : <IconReadme />}
      panel={panel}
    >
      <div className="about-readme">
        <div className="about-line-numbers" aria-hidden="true">
          {readmeLineNumbers.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div className="about-prose">
          <p>{c.desktopIntro}</p>
          <h4>{c.principlesHeading}</h4>
          <ul>
            {c.desktopPrinciples.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h4>{c.desktopStatusH2}</h4>
          <p>
            {c.currentStatus.prefix}
            <span className="about-seniority">[{c.currentStatus.role}]</span>
            {c.currentStatus.suffix}
          </p>
          <ul>
            {c.statusDetails.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </Module>
  );
}
