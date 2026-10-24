import { npmStackHeader, stackGroups } from '@/content/npm-stack';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconNpmStack } from '../../Icons';
import { Module } from '../../responsive/Module';

export function NpmStackSection({
  defer,
  panel = false,
}: {
  defer?: boolean;
  panel?: boolean;
} = {}) {
  return (
    <Module
      id="sec-npm-stack"
      header={npmStackHeader}
      srLabel={panel ? undefined : SECTION_LABELS['sec-npm-stack']}
      icon={panel ? undefined : <IconNpmStack />}
      defer={defer}
      panel={panel}
    >
      <dl className="about-stack">
        {stackGroups.map((group) => (
          <div key={group.label}>
            <dt>{group.label}</dt>
            <dd>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>{item.label}</li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </Module>
  );
}
