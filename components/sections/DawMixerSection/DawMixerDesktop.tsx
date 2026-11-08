import { FaderDbIsland } from '@/components/client/DawMixer/FaderIsland/FaderDbIsland.client';
import { KnobIsland } from '@/components/client/DawMixer/KnobIsland/KnobIsland.client';
import { RmsButtons } from '@/components/client/DawMixer/RmsButtons/RmsButtons.client';
import { VuMeter } from '@/components/client/DawMixer/VuMeter/VuMeter.client';
import { type DawMixerCopy, MASTER_CHANNEL_ID, METER_SEGMENTS } from '@/content/daw-mixer';
import type { DawMixer, DawMixerChannel } from '@/content/schemas';
import { cn } from '@/lib/cn';
import { FaderBar, ParsedText, SessionSummary, StrengthDots } from './DawMixerShared';

function PluginChain({
  plugins,
  channelId,
}: {
  plugins: DawMixerChannel['plugins'];
  channelId: string;
}) {
  return (
    <div className="plugin-chain">
      {plugins.map((p) => (
        <div
          key={p.name}
          className={cn(
            'plugin-chip border flex flex-col items-center gap-1',
            'pt-[5px] pb-[6px] text-primary-400 relative',
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
          <span className="text-xs font-bold text-center leading-tight overflow-hidden text-ellipsis max-w-full uppercase">
            {p.name}
          </span>
          <span className="flex gap-px items-end" aria-hidden="true">
            <StrengthDots strength={p.strength} dotClassName="w-[3px] h-1" />
          </span>
        </div>
      ))}
    </div>
  );
}

function ChannelDesktop({ ch, copy }: { ch: DawMixerChannel; copy: DawMixerCopy }) {
  const isMaster = ch.id === MASTER_CHANNEL_ID;
  return (
    <div
      className={cn(
        'daw-channel-row',
        'border-b border-[var(--color-primary-quiet)] px-[18px] py-[14px] relative',
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
    >
      <div className="flex flex-col gap-1">
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
        <span className="block text-xs text-primary-400">{ch.name}</span>
        <FaderBar pct={ch.faderPct} bright={ch.focused === true} />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span
          className={cn(
            'font-bold text-base text-tertiary-50 tracking-[0.04em] leading-none',
            (ch.focused || isMaster) && 'text-primary-500',
          )}
        >
          {ch.desktopName ?? ch.name}
        </span>
        <span className="text-xs text-primary-400 leading-[1.3] whitespace-nowrap overflow-hidden text-ellipsis">
          <ParsedText text={ch.desc} />
        </span>
      </div>
      <div className="flex gap-[10px] items-center justify-center">
        <KnobIsland
          initialAngle={ch.knob1.angleDeg}
          label={ch.knob1.label}
          channelName={ch.name}
          degreesUnit={copy.controls.degrees}
          hint={copy.controls.knobHint}
        />
        <KnobIsland
          initialAngle={ch.knob2.angleDeg}
          label={ch.knob2.label}
          channelName={ch.name}
          degreesUnit={copy.controls.degrees}
          hint={copy.controls.knobHint}
        />
      </div>
      <div className="flex justify-center">
        <RmsButtons
          buttons={ch.buttons}
          initialActive={ch.activeButtons}
          channelName={ch.name}
          buttonLabels={copy.controls.buttons}
        />
      </div>
      <div className="min-w-0">
        <PluginChain plugins={ch.plugins} channelId={ch.id} />
      </div>
      <div className="p-0">
        <VuMeter
          segments={METER_SEGMENTS}
          initialLevel={ch.meterPct}
          clipping={ch.meterClipping ?? false}
          channelName={ch.name}
          label={copy.controls.vuMeter}
        />
      </div>
      <FaderDbIsland
        decibelUnit={copy.decibelUnit}
        loudnessLabel={copy.loudnessLabel}
        peakLabel={copy.peakLabel}
        initialPct={ch.faderPct}
        channelName={ch.name}
        faderLabel={copy.controls.fader}
        footer={ch.footer}
      />
    </div>
  );
}

function SessionHeaderDesktop({ mixer, copy }: { mixer: DawMixer; copy: DawMixerCopy }) {
  return (
    <div
      className={cn(
        'daw-mixer-row-min grid gap-[18px] items-center px-[18px] py-3',
        'border-b border-[var(--color-primary-border)]',
        'bg-[color-mix(in_srgb,var(--color-primary-500)_5%,transparent)]',
        'text-xs text-primary-400 tracking-[0.14em]',
      )}
      data-testid="session-header"
    >
      <span>
        <SessionSummary mixer={mixer} copy={copy} />
      </span>
      <span className="mixer-transport tabular-nums">
        <span className="transport-play" aria-hidden="true" />
        <span className="text-primary-500 font-bold text-sm tracking-[0.06em]">
          {mixer.transportTime}
        </span>
        <span className="text-[var(--color-primary-quiet)]">{copy.transportSeparator}</span>
        <span>
          {mixer.bpm} {copy.bpmUnit}
        </span>
        <span className="text-[var(--color-primary-quiet)]">{copy.transportSeparator}</span>
        <span>{mixer.timeSignature}</span>
      </span>
    </div>
  );
}

function TableHeader({ copy }: { copy: DawMixerCopy }) {
  return (
    <div
      className={cn(
        'daw-channel-row daw-mixer-labels',
        'text-xs text-primary-400 tracking-[0.18em] uppercase',
        'border-b border-[var(--color-primary-quiet)] px-[18px] py-[7px]',
        'bg-black/50',
      )}
      aria-hidden="true"
    >
      <div>{copy.columns.id}</div>
      <div>{copy.columns.track}</div>
      <div>{copy.columns.io}</div>
      <div>{copy.columns.toggles}</div>
      <div>{copy.columns.pluginChain}</div>
      <div>{copy.columns.meter}</div>
      <div>{copy.columns.fader}</div>
      <div className="text-right">{copy.decibelUnit}</div>
    </div>
  );
}

export function DawMixerDesktop({ mixer, copy }: { mixer: DawMixer; copy: DawMixerCopy }) {
  return (
    <div
      className="daw-mixer-desktop font-mono text-sm text-tertiary-50 border border-[var(--color-primary-border)] bg-black/50 overflow-x-auto md:overflow-x-hidden"
      data-testid="daw-mixer-desktop"
    >
      <SessionHeaderDesktop mixer={mixer} copy={copy} />
      <TableHeader copy={copy} />
      {mixer.channels.map((ch) => (
        <ChannelDesktop key={ch.id} ch={ch} copy={copy} />
      ))}
    </div>
  );
}
