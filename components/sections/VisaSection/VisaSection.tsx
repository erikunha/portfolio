import { Suspense } from 'react';
import { visaRows } from '@/content/visa';
import { getIsMobile } from '@/lib/ua';
import { IconVisa } from '../../Icons';
import { Module } from '../../responsive/Module';

function VisaDesktop() {
  return (
    <div className="overflow-x-auto">
      <pre
        className="m-0 text-text-body font-mono text-sm leading-[1.85] whitespace-pre"
        data-testid="visa-desktop"
      >
        <span className="text-signal font-bold tracking-[0.06em]">
          {'JURISDICTION    STATUS                  EVIDENCE'}
        </span>
        {'\n'}
        <span className="text-signal opacity-55">
          {'================================================================'}
        </span>
        {'\n'}
        {visaRows.map((row) => (
          <span key={row.jurisdiction}>
            <span className="text-signal font-bold">{row.jurisdiction.padEnd(16)}</span>
            <span className="text-text-body">{row.status.padEnd(24)}</span>
            <span className="text-text-muted">{row.evidence}</span>
            {'\n'}
          </span>
        ))}
      </pre>
      <div className="text-text-muted text-xs mt-[14px] tracking-[0.04em]">
        {'// PT (native) · EN (C1) · FR (A2) · ES (A2)'}
      </div>
    </div>
  );
}

function VisaMobile() {
  return (
    <div className="overflow-x-auto">
      <div data-testid="visa-mobile">
        {/* Decorative rule — hidden on desktop, shown on mobile */}
        <div
          aria-hidden="true"
          className="text-signal opacity-55 font-mono text-xs overflow-hidden whitespace-nowrap mb-[0.5em]"
        >
          {'================================================================'}
        </div>
        <div className="mt-[0.5em] flex flex-col gap-2 font-mono text-sm">
          {visaRows.map((row) => (
            <div key={row.jurisdictionShort} className="flex gap-3 items-start">
              <span className="text-signal font-bold shrink-0 w-[8ch]">
                {row.jurisdictionShort}
              </span>
              <div className="flex flex-col gap-px">
                <span className="text-text-body">{row.statusShort}</span>
                <span className="text-text-muted">{row.evidence}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-text-muted text-xs mt-[14px] tracking-[0.04em] whitespace-nowrap overflow-hidden">
        {'// PT (native) · EN (C1) · FR (A2) · ES (A2)'}
      </div>
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
