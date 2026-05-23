import { credentials } from '@/content/credentials';
import { IconCredentials } from '../Icons';
import { Module } from '../responsive/Module';
import s from './CredentialsSection.module.css';

export function CredentialsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-credentials"
      header="CAT ~/.CREDENTIALS"
      icon={<IconCredentials />}
      defer={defer}
    >
      <div className={s.root}>
        <div className={s.cmdLine}>
          <span className={s.pr}>$</span>
          {'cat ~/.credentials'}
        </div>
        <div className={s.table}>
          {credentials.map((cred) => (
            <div key={cred.label} className={s.row}>
              <span className={s.label}>{cred.label}</span>
              <span className={s.badge}>{cred.badge}</span>
              <span className={s.val}>{cred.evidence}</span>
            </div>
          ))}
        </div>
      </div>
    </Module>
  );
}
