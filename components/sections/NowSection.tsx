
import { nowRows } from '@/content/now';
import { IconNow } from '../Icons';
import { Module } from '../responsive/Module';

export function NowSection() {
  return (
    <Module id="sec-now" header="CAT ~/.NOW" icon={<IconNow />}>
      <div className="nowblock">
        {nowRows.map((r) => (
          <div key={r.k} className="nrow">
            <span className="nk">{r.k}</span>
            <span className="nv">{r.v}</span>
          </div>
        ))}
      </div>
    </Module>
  );
}
