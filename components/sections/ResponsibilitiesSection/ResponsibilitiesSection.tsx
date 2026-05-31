import { responsibilities } from '@/content/responsibilities';
import { IconResponsibilities } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ResponsibilitiesSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-responsibilities"
      header="LS -LA ~/RESPONSIBILITIES"
      icon={<IconResponsibilities />}
      defer={defer}
    >
      <div className="overflow-x-auto">
        <div className="text-text-muted text-sm tracking-[0.06em] mb-[14px] max-[768px]:text-xs">
          <span className="text-signal mr-1.5">$</span>
          {'ls -la ~/responsibilities  '}
          <span style={{ color: 'var(--color-text-faint)' }}>
            {'// role boundaries, in unix terms'}
          </span>
        </div>
        <pre className="m-0 font-mono text-sm leading-[1.85] text-text-body whitespace-pre max-[768px]:text-xs max-[768px]:whitespace-pre-wrap max-[768px]:break-words">
          {responsibilities.map((r) => (
            <span key={r.name}>
              <span className="text-signal font-bold tracking-[0.02em]">{r.perms}</span>
              {'  '}
              <span className="text-text-muted">{r.user}</span>
              {'  '}
              <span className="text-accent-warm">{r.group}</span>
              {'  '}
              <span
                className="text-text-body"
                style={r.highlight ? { color: 'var(--color-signal)', fontWeight: 700 } : undefined}
                data-file
                data-highlight={r.highlight || undefined}
              >
                {r.name}
              </span>
              {'\n'}
            </span>
          ))}
        </pre>
        <div className="text-text-muted text-xs tracking-[0.06em] mt-4 pt-3 border-t border-dashed border-signal-quiet grid grid-cols-2 gap-1.5 gap-x-6 max-[900px]:grid-cols-1 max-[768px]:text-xs">
          <span>
            <span className="text-signal">drwxr-xr-x</span>
            {'  i own it, you can read it, you can run against it'}
          </span>
          <span>
            <span className="text-signal">drwxrwxrwx</span>
            {'  explicitly shared — please write here too'}
          </span>
          <span>
            <span className="text-signal">drwxr-x---</span>
            {'  owned, run only by trusted group (security, compliance)'}
          </span>
          <span>
            <span className="text-signal">-rwx------</span>
            {'  not delegable; this is the one i bring to the room'}
          </span>
        </div>
      </div>
    </Module>
  );
}
