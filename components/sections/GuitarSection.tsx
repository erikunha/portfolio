import { guitarRig } from '@/content/guitar-rig';
import { getIsMobileForRequest } from '@/lib/get-is-mobile-for-request';
import { IconGuitar } from '../Icons';
import { Module } from '../responsive/Module';

// Async RSC: renders only the matching viewport branch server-side.
// Same UA-detection pattern as Module.tsx — avoids shipping both desktop
// and mobile pre trees when only one is visible at a time.
export async function GuitarSection({ defer }: { defer?: boolean } = {}) {
  const isMobile = await getIsMobileForRequest();

  return (
    <Module
      id="sec-guitar"
      header="CAT ~/.GUITAR_RIG"
      icon={<IconGuitar />}
      defaultOpen={false}
      defer={defer}
    >
      <div className="visa">
        {isMobile ? (
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
        ) : (
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
        )}
      </div>
    </Module>
  );
}
