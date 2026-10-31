import { FaderDbIsland } from '@/components/client/DawMixer/FaderIsland/FaderDbIsland.client';
import { KnobIsland } from '@/components/client/DawMixer/KnobIsland/KnobIsland.client';
import { MixerScroll } from '@/components/client/DawMixer/MixerScroll.client';
import { RmsButtons } from '@/components/client/DawMixer/RmsButtons/RmsButtons.client';
import { VuMeter } from '@/components/client/DawMixer/VuMeter/VuMeter.client';
import { dawMixer, dawMixerConfig, dawMixerUi } from '@/content/daw-mixer';
import type { DawMixer, DawMixerChannel } from '@/content/schemas';
import { cn } from '@/lib/cn';

function ParsedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % dawMixerConfig.boldPartDivisor !== dawMixerConfig.boldPartRemainder) return part;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: split parts have no stable id
          <strong key={i}>{part}</strong>
        );
      })}
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
    <div className="flex items-stretch">
      {plugins.map((p) => (
        <div
          key={p.name}
          className={cn(
            'flex-none min-w-max border flex items-center gap-1',
            'px-2 py-[5px] text-primary-400 relative',
            p.active
              ? [
                  'plugin-card-on',
                  'text-primary-500 border-primary-500',
                  'bg-[color-mix(in_srgb,var(--color-primary-500)_8%,transparent)]',
                ].join(' ')
              : 'border-[var(--color-primary-quiet)] bg-black/55',
          )}
          data-testid={`plugin-${channelId}-${p.name}`}
        >
          <span className="text-xs font-bold tracking-[0.06em] whitespace-nowrap uppercase">
            {p.name}
          </span>
          <span className="flex gap-px items-end" aria-hidden="true">
            {Array.from({ length: dawMixerConfig.pluginStrengthSegments }, (_, i) => {
              const cls = cn(
                'block w-[3px] h-1 bg-primary-500',
                i >= p.strength && 'opacity-[0.22]',
              );
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: positional strength dots
                <span key={i} className={cls} />
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChannelDesktop({ ch }: { ch: DawMixerChannel }) {
  const isMaster = ch.id === dawMixerConfig.masterChannelId;
  return (
    <fieldset
      className={cn(
        'daw-channel-row m-0 min-w-0',
        'border-0 border-b border-[var(--color-primary-quiet)] relative',
        ch.focused && [
          'channel-row-focused',
          'bg-[color-mix(in_srgb,var(--color-primary-500)_6%,transparent)]',
        ],
        isMaster && [
          'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-primary-500)_8%,transparent),color-mix(in_srgb,var(--color-primary-500)_2%,transparent))]',
          'border-t border-t-primary-500',
        ],
      )}
      data-focused={ch.focused || undefined}
      data-channel={isMaster ? 'master' : undefined}
      data-testid={`channel-${ch.id}`}
      aria-label={`${ch.id} ${ch.desktopName ?? ch.name}`}
    >
      <div className="mx-channel-id flex">
        <span
          className={cn(
            'border px-[5px] py-[1px] text-xs font-mono text-primary-400 tracking-[0.04em] shrink-0',
            'border-[var(--color-primary-border)]',
            isMaster &&
              'border-primary-500 px-2 py-[2px] font-bold text-primary-500 tracking-[0.12em]',
          )}
          data-channel={isMaster ? 'master' : undefined}
        >
          {ch.id}
        </span>
        <span className="text-xs text-primary-400 max-md:hidden">{ch.name}</span>
        <div
          className="h-[6px] bg-[var(--color-primary-quiet)] border border-[var(--color-primary-quiet)] relative overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 bg-primary-500 opacity-85',
              ch.focused && 'opacity-100',
            )}
            style={{ width: `${ch.faderPct}%` }}
          />
        </div>
      </div>
      <div className="mx-channel-track flex flex-col gap-1 min-w-0">
        <span
          className={cn(
            'font-bold text-base text-tertiary-50 tracking-[0.04em] leading-none',
            (ch.focused || isMaster) && 'text-primary-500',
          )}
        >
          {ch.desktopName ?? ch.name}
        </span>
        <span className="mx-channel-desc text-sm text-primary-400 leading-[1.35]">
          <ParsedText text={ch.desc} />
        </span>
      </div>
      <div className="mx-channel-knobs flex gap-[10px] items-center">
        <KnobIsland initialAngle={ch.knob1.angleDeg} label={ch.knob1.label} channelName={ch.name} />
        <KnobIsland initialAngle={ch.knob2.angleDeg} label={ch.knob2.label} channelName={ch.name} />
      </div>
      <div className="mx-channel-buttons flex">
        <RmsButtons buttons={ch.buttons} initialActive={ch.activeButtons} channelName={ch.name} />
      </div>
      <div className="mx-channel-plugins min-w-0">
        <PluginChain plugins={ch.plugins} channelId={ch.id} />
      </div>
      <div className="mx-channel-meter p-0">
        <VuMeter
          segments={dawMixerConfig.meterSegments}
          initialLevel={ch.meterPct}
          clipping={ch.meterClipping ?? false}
          channelName={ch.name}
        />
      </div>
      <FaderDbIsland initialPct={ch.faderPct} channelName={ch.name} footer={ch.footer} />
    </fieldset>
  );
}

function SessionHeaderDesktop({ mixer }: { mixer: DawMixer }) {
  return (
    <div
      className={cn(
        'mx-session-header',
        'border-b border-[var(--color-primary-border)]',
        'bg-[color-mix(in_srgb,var(--color-primary-500)_5%,transparent)]',
        'text-xs text-primary-400 tracking-[0.14em]',
      )}
      data-testid="session-header"
    >
      <span>
        {dawMixerUi.sessionPrefix}
        <strong className="text-primary-500">{mixer.sessionName}</strong>
        {dawMixerUi.sessionSeparator}
        {mixer.channels.length - dawMixerConfig.masterChannelCount}
        {dawMixerUi.tracksSuffix}
        <span className="text-primary-500">{mixer.status}</span>
      </span>
      <span className="mx-session-transport tabular-nums">
        <span className="transport-play" aria-hidden="true" />
        <span className="text-primary-500 font-bold text-sm tracking-[0.06em]">
          {mixer.transportTime}
        </span>
        <span aria-hidden="true">{dawMixerUi.separator}</span>
        <span>
          {mixer.bpm} {dawMixerUi.bpmUnit}
        </span>
        <span aria-hidden="true">{dawMixerUi.separator}</span>
        <span>{mixer.timeSignature}</span>
      </span>
    </div>
  );
}

function TableHeader() {
  return (
    <div
      className={cn(
        'daw-channel-row mx-table-header',
        'text-xs max-md:text-[10px] text-primary-400 tracking-[0.18em] uppercase',
        'border-b border-[var(--color-primary-quiet)] px-[18px] py-[7px]',
        'bg-black/50',
      )}
      aria-hidden="true"
    >
      {dawMixerUi.columns.map((column) => (
        <div key={column}>{column}</div>
      ))}
    </div>
  );
}

export function DawMixerDesktop({
  skipTargetId = dawMixerUi.skipTargetId,
}: {
  skipTargetId?: string;
} = {}) {
  return (
    <div
      className="mx-mixer font-mono text-sm text-tertiary-50 border border-[var(--color-primary-border)] bg-black/50"
      data-testid="daw-mixer-desktop"
    >
      <SessionHeaderDesktop mixer={dawMixer} />
      <a className="mx-skip" href={`#${skipTargetId}`}>
        {dawMixerUi.skipLink}
      </a>
      <MixerScroll aria-label={dawMixerUi.regionLabel}>
        <div className="mx-grid">
          <TableHeader />
          {dawMixer.channels.map((ch) => (
            <ChannelDesktop key={ch.id} ch={ch} />
          ))}
        </div>
      </MixerScroll>
      <div id={skipTargetId} tabIndex={dawMixerConfig.skipTargetTabIndex} />
    </div>
  );
}
