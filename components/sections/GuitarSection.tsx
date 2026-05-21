import { Suspense } from 'react';
import { guitarRig } from '@/content/guitar-rig';
import { getIsMobile } from '@/lib/ua';
import { IconGuitar } from '../Icons';
import { Module } from '../responsive/Module';

function GuitarDesktop() {
  return (
    <div className="visa">
      <pre className="guitar-desktop">
        <span className="cmd-line">
          <span className="pr">$</span>
          {'cat ~/.guitar_rig'}
        </span>
        {'\n'}
        <span className="gr-comment">{guitarRig.comment}</span>
        {'\n\n'}
        {guitarRig.fields.map((f) => (
          <span key={f.label}>
            <span className="gr-label">{f.label}</span>
            {'  '}
            <span className="gr-val">{f.value}</span>
            {'\n'}
          </span>
        ))}
        {'\n'}
        <span className="gr-label">{'INFLUENCES'}</span>
        {'        '}
        <span className="gr-val">{'in order:'}</span>
        {'\n'}
        {guitarRig.influences.map((inf) => (
          <span key={inf.rank}>
            {'                      '}
            <span className="gr-num">{`${inf.rank}.`}</span>{' '}
            <span className="gr-name">{inf.name}</span>
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  );
}

function GuitarMobile() {
  return (
    <div className="visa">
      <pre
        className="guitar-mobile"
        style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.7 }}
      >
        <span className="cmd-line">
          <span className="pr">$</span>
          {'cat ~/.guitar_rig'}
        </span>
        {'\n'}
        <span className="gr-comment">{guitarRig.commentMobile}</span>
        {'\n\n'}
        {guitarRig.fields.map((f) => (
          <span key={f.labelMobile ?? f.label}>
            <span className="gr-label">{f.labelMobile ?? f.label}</span>
            {'  '}
            <span className="gr-val">{f.valueMobile ?? f.value}</span>
            {'\n'}
          </span>
        ))}
        {'\n'}
        <span className="gr-label">{'INFLUENCES'}</span>
        {'\n'}
        {guitarRig.influencesMobile.map((inf) => (
          <span key={inf.rank}>
            {'              '}
            <span className="gr-num">{`${inf.rank}.`}</span>{' '}
            <span className="gr-name">{inf.name}</span>
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  );
}

async function GuitarContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <GuitarMobile /> : <GuitarDesktop />;
}

export function GuitarSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-guitar" header="CAT ~/.GUITAR_RIG" icon={<IconGuitar />} defer={defer}>
      <Suspense fallback={<GuitarDesktop />}>
        <GuitarContent />
      </Suspense>
    </Module>
  );
}
