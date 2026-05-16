import { IconResponsibilities } from '../Icons';
import { Module } from '../responsive/Module';

export function ResponsibilitiesSection() {
  return (
    <Module
      id="sec-responsibilities"
      header="LS -LA ~/RESPONSIBILITIES"
      icon={<IconResponsibilities />}
      defaultOpen={false}
    >
      <div className="permatrix">
        <div className="pm-cmd">
          <span className="gt">$</span>
          {'ls -la ~/responsibilities  '}
          <span style={{ opacity: 0.55 }}>{'// role boundaries, in unix terms'}</span>
        </div>
        <pre>
          <span className="pm-perm">{'drwxr-xr-x'}</span>
          {'  '}
          <span className="pm-user">{'erik'}</span>
          {'  '}
          <span className="pm-group">{'core'}</span>
          {'  '}
          <span className="pm-file crit">{'frontend-architecture'}</span>
          {'\n'}
          <span className="pm-perm">{'drwxr-xr-x'}</span>
          {'  '}
          <span className="pm-user">{'erik'}</span>
          {'  '}
          <span className="pm-group">{'core'}</span>
          {'  '}
          <span className="pm-file crit">{'performance-optimization'}</span>
          {'\n'}
          <span className="pm-perm">{'drwxr-x---'}</span>
          {'  '}
          <span className="pm-user">{'erik'}</span>
          {'  '}
          <span className="pm-group">{'core'}</span>
          {'  '}
          <span className="pm-file crit">{'security-mindset'}</span>
          {'\n'}
          <span className="pm-perm">{'drwxrwxrwx'}</span>
          {'  '}
          <span className="pm-user">{'erik'}</span>
          {'  '}
          <span className="pm-group">{'team'}</span>
          {'  '}
          <span className="pm-file">{'mentoring-juniors'}</span>
          {'\n'}
          <span className="pm-perm">{'-rw-r--r--'}</span>
          {'  '}
          <span className="pm-user">{'erik'}</span>
          {'  '}
          <span className="pm-group">{'team'}</span>
          {'  '}
          <span className="pm-file">{'written-knowledge-system'}</span>
          {'\n'}
          <span className="pm-perm">{'drwxr-xr-x'}</span>
          {'  '}
          <span className="pm-user">{'erik'}</span>
          {'  '}
          <span className="pm-group">{'team'}</span>
          {'  '}
          <span className="pm-file">{'ai-tooling'}</span>
          {'\n'}
          <span className="pm-perm">{'-rwx------'}</span>
          {'  '}
          <span className="pm-user">{'erik'}</span>
          {'  '}
          <span className="pm-group">{'self'}</span>
          {'  '}
          <span className="pm-file">{'taste-and-judgment'}</span>
        </pre>
        <div className="pm-foot">
          <span>
            <span className="pm-k">drwxr-xr-x</span>
            {'  i own it, you can read it, you can run against it'}
          </span>
          <span>
            <span className="pm-k">drwxrwxrwx</span>
            {'  explicitly shared — please write here too'}
          </span>
          <span>
            <span className="pm-k">drwxr-x---</span>
            {'  owned, run only by trusted group (security, compliance)'}
          </span>
          <span>
            <span className="pm-k">-rwx------</span>
            {'  not delegable; this is the one i bring to the room'}
          </span>
        </div>
      </div>
    </Module>
  );
}
