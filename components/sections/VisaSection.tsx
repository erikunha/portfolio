import { visaRows } from '@/content/visa';
import { IconVisa } from '../Icons';
import { Module } from '../responsive/Module';

export function VisaSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-visa"
      header="CAT ~/.VISA"
      mobileHeader="CAT ~/.VISA"
      icon={<IconVisa />}
      defaultOpen={false}
      defer={defer}
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

        <div className="visa-mobile-pre">
          <div className="vm-grid">
            {visaRows.map((row) => (
              <div key={row.jurisdictionShort} className="vm-row">
                <span className="vjur">{row.jurisdictionShort}</span>
                <div className="vm-right">
                  <span className="vstat">{row.statusShort}</span>
                  <span className="vev">{row.evidence}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="visa-foot">{'// PT (native) · EN (C1) · FR (A2) · ES (A2)'}</div>
      </div>
    </Module>
  );
}
