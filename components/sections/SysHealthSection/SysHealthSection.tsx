import { sysStats } from '@/content/sys-health';
import { TerminalPanel } from '@/design-system';
import { IconSysHealth } from '../../Icons';
import { Module } from '../../responsive/Module';

export function SysHealthSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-sys-health"
      header="SYS_HEALTH_MONITOR"
      icon={<IconSysHealth />}
      defer={defer}
      variant="green"
    >
      {/* 4-col desktop, 2-col at ≤900px */}
      <div className="grid grid-cols-4 gap-[18px] max-[900px]:grid-cols-2 max-[900px]:gap-3">
        {sysStats.map((s) => (
          <TerminalPanel key={s.label} className="p-[18px] pb-5">
            <div className="text-text-muted text-sm tracking-[0.16em]">{s.label}</div>
            <div className="text-signal text-2xl font-bold my-2 mb-[14px] tracking-[0.02em] max-[900px]:text-xl">
              {s.value}
            </div>
            {/* bar-pulse class in components.css animates the <i> fill */}
            <div className="h-1.5 bg-signal-quiet relative overflow-hidden bar-pulse">
              <i className="block h-full bg-signal" style={{ width: s.pct }} />
            </div>
          </TerminalPanel>
        ))}
      </div>
    </Module>
  );
}
