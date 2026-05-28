import { type CSSProperties, Suspense } from 'react';
import { FaderIsland } from '@/components/client/DawMixer/FaderIsland/FaderIsland.client';
import { KnobIsland } from '@/components/client/DawMixer/KnobIsland/KnobIsland.client';
import { RmsButtons } from '@/components/client/DawMixer/RmsButtons/RmsButtons.client';
import { VuMeter } from '@/components/client/DawMixer/VuMeter/VuMeter.client';
import { dawMixer } from '@/content/daw-mixer';
import type { DawMixer, DawMixerChannel } from '@/content/schemas';
import { getIsMobile } from '@/lib/ua';
import { IconMixer } from '../../Icons';
import { Module } from '../../responsive/Module';
import s from './DawMixerSection.module.css';

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

function PluginChain({
  plugins,
  channelId,
}: {
  plugins: DawMixerChannel['plugins'];
  channelId: string;
}) {
  return (
    <div className={s.pluginChain}>
      {plugins.map((p) => (
        <div
          key={p.name}
          className={`${s.pluginCard} ${p.active ? s.pluginCardOn : s.pluginCardBypass}`}
          data-testid={`plugin-${channelId}-${p.name}`}
        >
          <span className={s.pluginName}>{p.name}</span>
          <span className={s.pluginAmt} aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: positional strength dots
              <span key={i} className={i < p.strength ? s.pluginDotOn : s.pluginDotOff} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChannelDesktop({ ch }: { ch: DawMixerChannel }) {
  const isMaster = ch.id === 'MASTER';
  return (
    <div
      className={`${s.channelRow} ${ch.focused ? s.channelFocused : ''} ${isMaster ? s.channelMaster : ''}`}
      data-testid={`channel-${ch.id}`}
    >
      <div className={s.colId}>
        <span className={isMaster ? s.masterBadge : s.channelBadge}>{ch.id}</span>
        <span className={s.channelSubName}>{ch.name}</span>
        <div className={s.clipBar} aria-hidden="true">
          <div className={s.clipFill} style={{ width: `${ch.faderPct}%` }} />
        </div>
      </div>
      <div className={s.colTrack}>
        <span className={s.trackName}>{ch.desktopName ?? ch.name}</span>
        <span className={s.trackDesc}>
          <ParsedText text={ch.desc} />
        </span>
      </div>
      <div className={s.colIo}>
        <KnobIsland initialAngle={ch.knob1.angleDeg} label={ch.knob1.label} channelName={ch.name} />
        <KnobIsland initialAngle={ch.knob2.angleDeg} label={ch.knob2.label} channelName={ch.name} />
      </div>
      <div className={s.colRms}>
        <RmsButtons buttons={ch.buttons} initialActive={ch.activeButtons} channelName={ch.name} />
      </div>
      <div className={s.colPlugins}>
        <PluginChain plugins={ch.plugins} channelId={ch.id} />
      </div>
      <div className={s.colMeter}>
        <VuMeter
          segments={12}
          initialLevel={ch.meterPct}
          clipping={ch.meterClipping ?? false}
          channelName={ch.name}
        />
      </div>
      <div className={s.colFader}>
        <FaderIsland initialPct={ch.faderPct} channelName={ch.name} />
      </div>
      <div className={s.colDb}>
        <span className={s.dbValue}>{ch.db}</span>
        <span className={s.dbUnit}>dB</span>
        {ch.footer && (
          <span className={s.lufs}>
            LUFS {ch.footer.lufs} · PK {ch.footer.pk}
          </span>
        )}
      </div>
    </div>
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

function MixLegend({ mixer }: { mixer: DawMixer }) {
  const lead = mixer.channels.find((ch) => ch.focused && ch.id !== 'MASTER');
  return (
    <div className={s.mixLegend} aria-hidden="true">
      <span>
        <span className={s.mixLegendDot} />
        {mixer.channels.length - 1}
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

function SessionHeaderDesktop({ mixer }: { mixer: DawMixer }) {
  return (
    <div className={s.sessionHeader} data-testid="session-header">
      <span>
        {'SESSION: '}
        <strong className={s.sessionName}>{mixer.sessionName}</strong>
        {' · '}
        {mixer.channels.length - 1}
        {' GTR TRACKS + MASTER · '}
        <span className={s.statusArm}>{mixer.status}</span>
      </span>
      <span className={s.transport}>
        <span className={s.transportPlay} aria-hidden="true" />
        <span className={s.transportTime}>{mixer.transportTime}</span>
        <span className={s.transportSep}>|</span>
        <span>{mixer.bpm} BPM</span>
        <span className={s.transportSep}>|</span>
        <span>{mixer.timeSignature}</span>
      </span>
    </div>
  );
}

function SessionHeaderMobile({ mixer }: { mixer: DawMixer }) {
  return (
    <div className={s.sessionHeaderMobile} data-testid="session-header-mobile">
      <div>
        {'SESSION: '}
        {mixer.sessionName}
        {' · '}
        <span className={s.statusArm}>{mixer.status}</span>
      </div>
      <div>
        {'▶ '}
        {mixer.transportTime}
        {' | '}
        {mixer.bpm}
        {' BPM | '}
        {mixer.timeSignature}
      </div>
      <div>
        <span className={s.statusArm}>{mixer.channels.length - 1}</span>
        {' GTR + MASTER'}
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div className={s.tableHeader} aria-hidden="true">
      <div>ID</div>
      <div>TRACK</div>
      <div>I/O</div>
      <div>R/M/S</div>
      <div>PLUGIN CHAIN</div>
      <div>METER</div>
      <div>FADER</div>
      <div className={s.colEndLabel}>dB</div>
    </div>
  );
}

export function DawMixerDesktop() {
  return (
    <div className={s.root} data-testid="daw-mixer-desktop">
      <SessionHeaderDesktop mixer={dawMixer} />
      <TableHeader />
      {dawMixer.channels.map((ch) => (
        <ChannelDesktop key={ch.id} ch={ch} />
      ))}
    </div>
  );
}

export function DawMixerMobile() {
  return (
    <div className={s.rootMobile} data-testid="daw-mixer-mobile">
      <SessionHeaderMobile mixer={dawMixer} />
      <MixLegend mixer={dawMixer} />
      {dawMixer.channels.map((ch) => (
        <ChannelMobile key={ch.id} ch={ch} />
      ))}
    </div>
  );
}

export async function DawMixerContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <DawMixerMobile /> : <DawMixerDesktop />;
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
