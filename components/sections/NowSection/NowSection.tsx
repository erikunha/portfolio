import { nowHeader, nowRows } from '@/content/now';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconNow } from '../../Icons';
import { Module } from '../../responsive/Module';

export function NowSection({ defer, panel = false }: { defer?: boolean; panel?: boolean } = {}) {
  return (
    <Module
      id="sec-now"
      header={nowHeader}
      srLabel={panel ? undefined : SECTION_LABELS['sec-now']}
      icon={panel ? undefined : <IconNow />}
      defer={defer}
      panel={panel}
    >
      <dl className="about-now">
        {nowRows.map((row) => (
          <div key={row.k}>
            <dt>{row.k}</dt>
            <dd>{row.v}</dd>
          </div>
        ))}
      </dl>
    </Module>
  );
}
