
import { sysStats } from '@/content/sys-health';
import { IconSysHealth } from '../Icons';
import { Module } from '../responsive/Module';

export function SysHealthSection() {
  return (
    <Module id="sec-sys-health" header="SYS_HEALTH_MONITOR" icon={<IconSysHealth />}>
      <div className="stats">
        {sysStats.map((s) => (
          <div key={s.label} className="stat">
            <div className="slbl">{s.label}</div>
            <div className="sval">{s.value}</div>
            <div className="bar pulse"><i style={{ width: s.pct }} /></div>
          </div>
        ))}
      </div>
    </Module>
  );
}
