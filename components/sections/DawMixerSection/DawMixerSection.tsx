import dynamic from 'next/dynamic';
import { type CSSProperties, Suspense } from 'react';
import { dawMixer } from '@/content/daw-mixer';
import type { DawMixerChannel } from '@/content/schemas';
import { getIsMobile } from '@/lib/ua';
import { IconMixer } from '../../Icons';
import { Module } from '../../responsive/Module';
import s from './DawMixerSection.module.css';

// Desktop content (with interactive client islands) is code-split so its JS
// chunk is excluded from the mobile bundle — mobile renders static components only.
const DawMixerDesktopDynamic = dynamic(() =>
  import('./DawMixerDesktop').then((m) => m.DawMixerDesktop),
);

function ParsedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: split parts have no stable id
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
      )}
    </>
  );
}

function StaticMeter({
  pct,
  segments,
  clipping,
}: {
  pct: number;
  segments: number;
  clipping: boolean;
}) {
  const filledCount = Math.round((pct / 100) * segments);
  return (
    <div className={s.staticMeter} aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => {
        const isRed = clipping && pct > 85 && i >= segments - 2 && i < filledCount;
        const cls = isRed ? s.segRed : i < filledCount ? s.segFilled : s.segEmpty;
        // biome-ignore lint/suspicious/noArrayIndexKey: positional segments — no stable id exists
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}

function StaticFader({ pct }: { pct: number }) {
  return (
    <div className={s.mxFader} aria-hidden="true">
      <div className={s.mxFaderThumb} style={{ left: `${pct}%` }} />
    </div>
  );
}

function StaticKnob({ angleDeg, label }: { angleDeg: number; label: string }) {
  return (
    <div className={s.mxKnob}>
      <div
        className={s.mxDial}
        style={{ '--mx-knob-angle': `${angleDeg}deg` } as CSSProperties}
        aria-hidden="true"
      />
      <span className={s.mxKnobLabel}>{label}</span>
    </div>
  );
}

function PluginChainMobile({
  plugins,
  channelId,
}: {
  plugins: DawMixerChannel['plugins'];
  channelId: string;
}) {
  return (
    <div className={s.mxChainWrap}>
      <div className={s.mxChainTitle}>{'// signal flow'}</div>
      <div className={s.mxChain}>
        {plugins.map((p) => (
          <div
            key={p.name}
            className={`${s.mxPlug} ${p.active ? s.mxPlugOn : s.mxPlugBypass}`}
            data-testid={`plugin-mobile-${channelId}-${p.name}`}
          >
            <span className={s.mxPlugLed} aria-hidden="true" />
            <span className={s.mxPlugName}>{p.name}</span>
            <span className={s.mxPlugAmt} aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: positional strength dots
                <span key={i} className={i < p.strength ? s.mxPlugAmtOn : s.mxPlugAmtOff} />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionHeaderMobile() {
  return (
    <div className={s.sessionHeaderMobile} data-testid="session-header-mobile">
      <div>
        {'SESSION: '}
        {dawMixer.sessionName}
        {' · '}
        <span className={s.statusArm}>{dawMixer.status}</span>
      </div>
      <div>
        {'▶ '}
        {dawMixer.transportTime}
        {' | '}
        {dawMixer.bpm}
        {' BPM | '}
        {dawMixer.timeSignature}
      </div>
      <div>
        <span className={s.statusArm}>{dawMixer.channels.length - 1}</span>
        {' GTR + MASTER'}
      </div>
    </div>
  );
}

function MixLegendMobile() {
  const lead = dawMixer.channels.find((ch) => ch.focused && ch.id !== 'MASTER');
  return (
    <div className={s.mixLegend} aria-hidden="true">
      <span>
        <span className={s.mixLegendDot} />
        {dawMixer.channels.length - 1}
        {' GTR + MASTER'}
      </span>
      {lead && (
        <span>
          {lead.id}
          {' = lead'}
        </span>
      )}
    </div>
  );
}

function ChannelMobile({ ch }: { ch: DawMixerChannel }) {
  const isMaster = ch.id === 'MASTER';
  return (
    <div
      className={`${s.channelCard} ${ch.focused ? s.channelCardFocused : ''} ${isMaster ? s.channelCardMaster : ''}`}
      data-testid={`channel-mobile-${ch.id}`}
    >
      <div className={s.mxHead}>
        <span className={isMaster ? s.masterBadge : s.mxId}>{ch.id}</span>
        <span className={s.mxName}>{ch.name}</span>
        <div className={s.mxDb}>
          <span className={s.dbValue}>{ch.db}</span>
          <span className={s.dbUnit}>dB</span>
        </div>
      </div>
      <div className={s.mxRef}>
        <ParsedText text={ch.desc} />
      </div>
      <div className={s.mxMeters}>
        <StaticMeter pct={ch.meterPct} segments={12} clipping={ch.meterClipping ?? false} />
        <StaticFader pct={ch.faderPct} />
      </div>
      <PluginChainMobile plugins={ch.plugins} channelId={ch.id} />
      <div className={s.mxCtrls}>
        <div className={s.mxCtrlRow}>
          <div className={s.mxKnobRow}>
            <StaticKnob angleDeg={ch.knob1.angleDeg} label={ch.knob1.label} />
            <StaticKnob angleDeg={ch.knob2.angleDeg} label={ch.knob2.label} />
          </div>
        </div>
        <div className={s.mxCtrlRow}>
          <div className={s.mxBtns}>
            {ch.buttons.map((btn) => (
              <div key={btn} className={ch.activeButtons.includes(btn) ? s.mxBtnOn : s.mxBtn}>
                {btn}
              </div>
            ))}
          </div>
        </div>
        <div className={s.mxCtrlRow}>
          <div className={s.mxClip} aria-hidden="true">
            <div className={s.mxClipFill} style={{ width: `${ch.faderPct}%` }} />
          </div>
          {ch.footer && (
            <span className={s.lufs}>
              LUFS {ch.footer.lufs} · PK {ch.footer.pk}
            </span>
          )}
        </div>
      </div>
      {ch.terminalLines && (
        <div className={s.terminalBlock}>
          {ch.terminalLines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional terminal lines
            <div key={i} className={s.terminalLine}>
              <ParsedText text={line} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DawMixerMobile() {
  return (
    <div className={s.rootMobile} data-testid="daw-mixer-mobile">
      <SessionHeaderMobile />
      <MixLegendMobile />
      {dawMixer.channels.map((ch) => (
        <ChannelMobile key={ch.id} ch={ch} />
      ))}
    </div>
  );
}

export async function DawMixerContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <DawMixerMobile /> : <DawMixerDesktopDynamic />;
}

export function DawMixerSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-daw-mixer" header="./MIX --LIVE — DAW MIXER" icon={<IconMixer />} defer={defer}>
      <Suspense fallback={null}>
        <DawMixerContent />
      </Suspense>
    </Module>
  );
}
