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
        <pre>
          <span className="cmd-line">
            <span className="pr">$</span>
            {'cat ~/.credentials'}
          </span>
          {'\n\n'}
          {credentials.map((cred) => (
            <span key={cred.label}>
              <span className="cr-label">{cred.label.padEnd(14)}</span>
              <span className="cr-badge">{cred.badge.padEnd(25)}</span>
              <span className="cr-val">{cred.evidence}</span>
              {'\n'}
            </span>
          ))}
        </pre>
      </div>
    </Module>
  );
}
