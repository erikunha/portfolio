import { nowRows } from '@/content/now';
import { IconNow } from '../../Icons';
import { Module } from '../../responsive/Module';

export function NowSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-now" header="CAT ~/.NOW" icon={<IconNow />} defer={defer}>
      <div className="text-sm leading-[1.9] max-[768px]:text-xs">
        {nowRows.map((r) => (
          <div
            key={r.k}
            className="grid grid-cols-[110px_1fr] gap-4 max-[900px]:grid-cols-[90px_1fr] max-[900px]:gap-2.5"
          >
            <span className="text-signal tracking-[0.04em]">{r.k}</span>
            <span className="text-text-body">{r.v}</span>
          </div>
        ))}
      </div>
    </Module>
  );
}
