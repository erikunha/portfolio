import { FaderIsland } from '@/components/client/DawMixer/FaderIsland/FaderIsland.client';
import { KnobIsland } from '@/components/client/DawMixer/KnobIsland/KnobIsland.client';
import { RmsButtons } from '@/components/client/DawMixer/RmsButtons/RmsButtons.client';
import { VuMeter } from '@/components/client/DawMixer/VuMeter/VuMeter.client';
import { dawMixer } from '@/content/daw-mixer';
import type { DawMixer, DawMixerChannel } from '@/content/schemas';
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
