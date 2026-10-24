import { readmeCopy } from '@/content/readme';
import { responsibilities } from '@/content/responsibilities';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconResponsibilities } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ResponsibilitiesSection({
  defer,
  panel = false,
}: {
  defer?: boolean;
  panel?: boolean;
} = {}) {
  return (
    <Module
      id="sec-responsibilities"
      header={readmeCopy.responsibilitiesHeading}
      srLabel={panel ? undefined : SECTION_LABELS['sec-responsibilities']}
      icon={panel ? undefined : <IconResponsibilities />}
      defer={defer}
      panel={panel}
    >
      <p className="about-command">
        {readmeCopy.responsibilitiesCommand} {readmeCopy.responsibilitiesNote}
      </p>
      <ul className="about-responsibilities">
        {responsibilities.map((row) => (
          <li key={row.name}>
            <span className="responsibility-permissions">{row.perms}</span>
            <span className="responsibility-owner">{row.user}</span>
            <span className="responsibility-group">{row.group}</span>
            <span
              className="responsibility-name"
              data-file
              data-highlight={row.highlight || undefined}
            >
              {row.name}
            </span>
          </li>
        ))}
      </ul>
    </Module>
  );
}
