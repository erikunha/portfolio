import { responsibilities } from '@/content/responsibilities';
import { IconResponsibilities } from '../Icons';
import { Module } from '../responsive/Module';

export function ResponsibilitiesSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-responsibilities"
      header="LS -LA ~/RESPONSIBILITIES"
      icon={<IconResponsibilities />}
      defaultOpen={false}
      defer={defer}
    >
      <div className="permatrix">
        <div className="pm-cmd">
          <span className="gt">$</span>
          {'ls -la ~/responsibilities  '}
          <span style={{ opacity: 0.55 }}>{'// role boundaries, in unix terms'}</span>
        </div>
        <pre>
          {responsibilities.map((r) => (
            <span key={r.name}>
              <span className="pm-perm">{r.perms}</span>
              {'  '}
              <span className="pm-user">{r.user}</span>
              {'  '}
              <span className="pm-group">{r.group}</span>
              {'  '}
              <span className={`pm-file${r.highlight ? ' crit' : ''}`}>{r.name}</span>
              {'\n'}
            </span>
          ))}
        </pre>
        <div className="pm-foot">
          <span>
            <span className="pm-k">drwxr-xr-x</span>
            {'  i own it, you can read it, you can run against it'}
          </span>
          <span>
            <span className="pm-k">drwxrwxrwx</span>
            {'  explicitly shared — please write here too'}
          </span>
          <span>
            <span className="pm-k">drwxr-x---</span>
            {'  owned, run only by trusted group (security, compliance)'}
          </span>
          <span>
            <span className="pm-k">-rwx------</span>
            {'  not delegable; this is the one i bring to the room'}
          </span>
        </div>
      </div>
    </Module>
  );
}
