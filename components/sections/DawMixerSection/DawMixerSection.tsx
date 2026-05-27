import { Suspense } from 'react';
import { FaderIsland } from '@/components/client/DawMixer/FaderIsland.client';
import { KnobIsland } from '@/components/client/DawMixer/KnobIsland.client';
import { RmsButtons } from '@/components/client/DawMixer/RmsButtons.client';
import { VuMeter } from '@/components/client/DawMixer/VuMeter.client';
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

function StrengthDots({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <div role="img" className={s.dots} aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional dots — no stable id exists
        <span key={i} className={i < filled ? s.dotFilled : s.dotEmpty} />
      ))}
    </div>
  );
}

function PluginList({
  plugins,
  channelId,
}: {
  plugins: DawMixerChannel['plugins'];
  channelId: string;
}) {
  return (
    <details className={s.signalFlow} open>
      <summary className={s.signalFlowToggle}>
        {'// SIGNAL FLOW '}
        <span className={s.signalFlowDot} aria-hidden="true">
          ●
        </span>
      </summary>
      {plugins.map((p) => (
        <div
          key={p.name}
          className={p.active ? s.pluginRowActive : s.pluginRowInactive}
          data-testid={`plugin-${channelId}-${p.name}`}
        >
          <span className={s.pluginBullet} aria-hidden="true">
            {p.active ? '●' : '○'}
          </span>
          <span className={s.pluginName}>{p.name}</span>
          <StrengthDots filled={p.strength} total={5} />
        </div>
      ))}
    </details>
  );
}

function ChannelDesktop({ ch }: { ch: DawMixerChannel }) {
  const isMaster = ch.id === 'MASTER';
  return (
    <div
      className={`${s.channelRow} ${ch.focused ? s.channelFocused : ''}`}
      data-testid={`channel-${ch.id}`}
    >
      <div className={s.colId}>
        <span className={isMaster ? s.masterBadge : s.channelBadge}>{ch.id}</span>
        <span className={s.channelSubName}>{ch.name}</span>
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
        <RmsButtons buttons={ch.buttons} initialActive={ch.activeButtons} />
      </div>
      <div className={s.colPlugins}>
        <PluginList plugins={ch.plugins} channelId={ch.id} />
      </div>
      <div className={s.colMeter}>
        <VuMeter
          segments={14}
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

function ChannelMobile({ ch }: { ch: DawMixerChannel }) {
  const isMaster = ch.id === 'MASTER';
  return (
    <div
      className={`${s.channelCard} ${ch.focused ? s.channelCardFocused : ''}`}
      data-testid={`channel-mobile-${ch.id}`}
    >
      <div className={s.cardHeader}>
        <span className={isMaster ? s.masterBadge : s.channelBadge}>{ch.id}</span>
        <span className={s.cardName}>{ch.name}</span>
        <div className={s.cardDb}>
          <span className={s.dbValue}>{ch.db}</span>
          <span className={s.dbUnit}> dB</span>
        </div>
      </div>
      <div className={s.cardDesc}>
        <ParsedText text={ch.desc} />
      </div>
      <VuMeter
        segments={14}
        initialLevel={ch.meterPct}
        clipping={ch.meterClipping ?? false}
        channelName={ch.name}
      />
      <FaderIsland initialPct={ch.faderPct} channelName={ch.name} />
      <PluginList plugins={ch.plugins} channelId={`${ch.id}-mobile`} />
      <div className={s.cardKnobs}>
        <KnobIsland initialAngle={ch.knob1.angleDeg} label={ch.knob1.label} channelName={ch.name} />
        <KnobIsland initialAngle={ch.knob2.angleDeg} label={ch.knob2.label} channelName={ch.name} />
      </div>
      <div className={s.cardButtons}>
        <RmsButtons buttons={ch.buttons} initialActive={ch.activeButtons} />
      </div>
      <div className={s.cardFooter}>
        <div className={s.faderFooterBar} style={{ width: `${ch.faderPct}%` }} aria-hidden="true" />
        {ch.footer && (
          <span className={s.lufs}>
            LUFS {ch.footer.lufs} · PK {ch.footer.pk}
          </span>
        )}
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
        {mixer.sessionName}
        {' · '}
        {mixer.channels.length - 1}
        {' GTR TRACKS + MASTER · '}
        <span className={s.statusDot}>●</span>
        {' MIXING'}
      </span>
      <span>
        {'▶ 00:01:24:08 | '}
        {mixer.bpm}
        {' BPM | '}
        {mixer.timeSignature}
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
        <span className={s.statusDot}>●</span>
        {' MIXING'}
      </div>
      <div>
        {'▶ 00:01:24:08 | '}
        {mixer.bpm}
        {' BPM | '}
        {mixer.timeSignature}
      </div>
      <div>
        <span className={s.statusDot}>●</span> {mixer.channels.length - 1}
        {' GTR + MASTER'}
      </div>
      <div className={s.tapHint}>TAP A ROW TO FOCUS</div>
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
      <div>DB</div>
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
      <Suspense fallback={<DawMixerDesktop />}>
        <DawMixerContent />
      </Suspense>
    </Module>
  );
}
