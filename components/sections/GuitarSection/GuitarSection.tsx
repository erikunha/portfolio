import { Suspense } from 'react';
import { guitarRig } from '@/content/guitar-rig';
import { getIsMobile } from '@/lib/ua';
import { IconGuitar } from '../../Icons';
import { Module } from '../../responsive/Module';
import s from './GuitarSection.module.css';

function GuitarDesktop() {
  return (
    <div className={s.root}>
      <pre data-testid="guitar-desktop">
        <span className={s.cmdLine}>
          <span className={s.pr}>$</span>
          {'cat ~/.guitar_rig'}
        </span>
        {'\n'}
        <span className={s.grComment}>{guitarRig.comment}</span>
        {'\n\n'}
        {guitarRig.fields.map((f) => (
          <span key={f.label}>
            <span className={s.grLabel}>{f.label}</span>
            {'  '}
            <span className={s.grVal}>{f.value}</span>
            {'\n'}
          </span>
        ))}
        {'\n'}
        <span className={s.grLabel}>{'INFLUENCES'}</span>
        {'        '}
        <span className={s.grVal}>{'in order:'}</span>
        {'\n'}
        {guitarRig.influences.map((inf) => (
          <span key={inf.rank}>
            {'                      '}
            <span className={s.grNum}>{`${inf.rank}.`}</span>{' '}
            <span className={s.grName}>{inf.name}</span>
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  );
}

function GuitarMobile() {
  return (
    <div className={s.root}>
      <pre className={s.guitarMobile} data-testid="guitar-mobile">
        <span className={s.cmdLine}>
          <span className={s.pr}>$</span>
          {'cat ~/.guitar_rig'}
        </span>
        {'\n'}
        <span className={s.grComment}>{guitarRig.commentMobile}</span>
        {'\n\n'}
        {guitarRig.fields.map((f) => (
          <span key={f.labelMobile ?? f.label}>
            <span className={s.grLabel}>{f.labelMobile ?? f.label}</span>
            {'  '}
            <span className={s.grVal}>{f.valueMobile ?? f.value}</span>
            {'\n'}
          </span>
        ))}
        {'\n'}
        <span className={s.grLabel}>{'INFLUENCES'}</span>
        {'\n'}
        {guitarRig.influencesMobile.map((inf) => (
          <span key={inf.rank}>
            {'              '}
            <span className={s.grNum}>{`${inf.rank}.`}</span>{' '}
            <span className={s.grName}>{inf.name}</span>
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  );
}

export async function GuitarContent() {
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
