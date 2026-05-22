import { Suspense } from 'react';
import { visaRows } from '@/content/visa';
import { getIsMobile } from '@/lib/ua';
import { IconVisa } from '../Icons';
import { Module } from '../responsive/Module';
import s from './VisaSection.module.css';

function VisaDesktop() {
  return (
    <div className={s.root}>
      <pre className="visa-desktop-pre">
        <span className={s.vh}>{'JURISDICTION    STATUS                  EVIDENCE'}</span>
        {'\n'}
        <span className={s.vrule}>
          {'================================================================'}
        </span>
        {'\n'}
        {visaRows.map((row) => (
          <span key={row.jurisdiction}>
            <span className={s.vjur}>{row.jurisdiction.padEnd(16)}</span>
            <span className={s.vstat}>{row.status.padEnd(24)}</span>
            <span className={s.vev}>{row.evidence}</span>
            {'\n'}
          </span>
        ))}
      </pre>
      <div className={s.foot}>{'// PT (native) · EN (C1) · FR (A2) · ES (A2)'}</div>
    </div>
  );
}

function VisaMobile() {
  return (
    <div className={s.root}>
      <div className="visa-mobile-pre">
        <div className={s.vmGrid}>
          {visaRows.map((row) => (
            <div key={row.jurisdictionShort} className={s.vmRow}>
              <span className={s.vjur}>{row.jurisdictionShort}</span>
              <div className={s.vmRight}>
                <span className={s.vstat}>{row.statusShort}</span>
                <span className={s.vev}>{row.evidence}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={s.foot}>{'// PT (native) · EN (C1) · FR (A2) · ES (A2)'}</div>
    </div>
  );
}

export async function VisaContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <VisaMobile /> : <VisaDesktop />;
}

export function VisaSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-visa"
      header="CAT ~/.VISA"
      mobileHeader="CAT ~/.VISA"
      icon={<IconVisa />}
      defer={defer}
    >
      <Suspense fallback={<VisaDesktop />}>
        <VisaContent />
      </Suspense>
    </Module>
  );
}
