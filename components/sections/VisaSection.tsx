import { visaRows } from '@/content/visa';
import { IconVisa } from '../Icons';
import { Module } from '../responsive/Module';

export function VisaSection() {
  return (
    <Module
      id="sec-visa"
      header="CAT ~/.VISA"
      mobileHeader="CAT ~/.VISA & .CREDENTIALS"
      icon={<IconVisa />}
      defaultOpen={false}
    >
      <div className="visa">
        <pre className="visa-desktop-pre">
          <span className="vh">{'JURISDICTION    STATUS                  EVIDENCE'}</span>
          {'\n'}
          <span className="vrule">
            {'================================================================'}
          </span>
          {'\n'}
          {visaRows.map((row) => (
            <span key={row.jurisdiction}>
              <span className="vjur">{row.jurisdiction.padEnd(16)}</span>
              <span className="vstat">{row.status.padEnd(24)}</span>
              <span className="vev">{row.evidence}</span>
              {'\n'}
            </span>
          ))}
        </pre>

        <pre className="visa-mobile-pre">
          <span className="cmd-line">
            <span className="pr">$</span>
            {' cat ~/.visa'}
          </span>
          {'\n\n'}
          <span className="vh">{'REGION    STATUS'}</span>
          {'\n'}
          <span className="vrule">{'================================'}</span>
          {'\n'}
          {visaRows.map((row) => (
            <span key={row.jurisdictionShort}>
              <span className="vjur">{row.jurisdictionShort}</span>
              {'   '}
              <span className="vstat">{row.statusShort}</span>
              {'\n          '}
              <span className="vev">{row.evidence}</span>
              {'\n'}
            </span>
          ))}
        </pre>

        <div className="visa-foot">{'// PT (native) · EN (C1) · FR (A2) · ES (A2)'}</div>
      </div>

      <div className="visa-mobile-creds">
        <pre>
          <span className="cmd-line">
            <span className="pr">$</span>
            {' cat ~/.credentials'}
          </span>
          {'\n\n'}
          <span className="cr-label">{'ANGULAR_DEV'}</span>
          {'  '}
          <span className="cr-badge">{'CERTIFIED'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'Alain Chautard (GDE) · 2024'}</span>
          {'\n'}
          <span className="cr-label">{'ENGLISH'}</span>
          {'      '}
          <span className="cr-badge">{'IELTS_C1'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'band 6.5 · 2023'}</span>
          {'\n'}
          <span className="cr-label">{'INTL_DEGREE'}</span>
          {'  '}
          <span className="cr-badge">{'WES_VERIFIED'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'World Education Svcs · 2022'}</span>
        </pre>
      </div>
    </Module>
  );
}
