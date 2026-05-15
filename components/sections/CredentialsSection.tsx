
import { IconCredentials } from '../Icons';
import { Module } from '../responsive/Module';

export function CredentialsSection() {
  return (
    <Module id="sec-credentials" header="CAT ~/.CREDENTIALS" icon={<IconCredentials />} defaultOpen={false}>
      <div className="visa">
        <pre>
          <span className="cmd-line"><span className="pr">$</span>{'cat ~/.credentials'}</span>
          {'\n\n'}
          <span className="cr-label">{'ANGULAR_DEV'}</span>
          {'     '}
          <span className="cr-badge">{'CERTIFIED'}</span>
          {'       '}
          <span className="cr-val">{'Alain Chautard (GDE Angular) · 2024'}</span>
          {'\n'}
          <span className="cr-label">{'ENGLISH'}</span>
          {'         '}
          <span className="cr-badge">{'IELTS_C1'}</span>
          {'        '}
          <span className="cr-val">{'band 6.5 (speaking & listening) · 2023'}</span>
          {'\n'}
          <span className="cr-label">{'INTL_DEGREE'}</span>
          {'     '}
          <span className="cr-badge">{'WES_VERIFIED'}</span>
          {'    '}
          <span className="cr-val">{'World Education Services · 2022'}</span>
        </pre>
      </div>
    </Module>
  );
}
