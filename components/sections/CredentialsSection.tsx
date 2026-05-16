import { credentials } from '@/content/credentials';
import { IconCredentials } from '../Icons';
import { Module } from '../responsive/Module';

export function CredentialsSection() {
  return (
    <Module
      id="sec-credentials"
      header="CAT ~/.CREDENTIALS"
      icon={<IconCredentials />}
      defaultOpen={false}
    >
      <div className="visa">
        <div className="cmd-line">
          <span className="pr">$</span>
          {'cat ~/.credentials'}
        </div>
        <div className="cr-table">
          {credentials.map((cred) => (
            <div key={cred.label} className="cr-row">
              <span className="cr-label">{cred.label}</span>
              <span className="cr-badge">{cred.badge}</span>
              <span className="cr-val">{cred.evidence}</span>
            </div>
          ))}
        </div>
      </div>
    </Module>
  );
}
