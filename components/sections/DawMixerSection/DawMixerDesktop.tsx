import { useId } from 'react';
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
            'pt-snug pb-pip relative',
            p.active ? 'plugin-card-on mx-plugin-chip-on' : 'mx-plugin-chip-off',
          )}
          data-testid={`plugin-${channelId}-${p.name}`}
        >
          <span className="text-xs font-bold text-center leading-ratio-tight overflow-hidden text-ellipsis max-w-full uppercase">
            {p.name}
          </span>
          <span className="flex gap-px items-end" aria-hidden="true">
            <StrengthDots strength={p.strength} dotClassName="w-tight h-1" />
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
        'border-b border-[var(--color-signal-quiet)] px-panel-wide py-panel relative',
        ch.focused && ['channel-row-focused', 'bg-(color:--color-accent-tint-faint)'],
        isMaster && ['mx-master-gradient-desktop', 'border-t border-t-(color:--color-accent)'],
      )}
      data-focused={ch.focused || undefined}
      data-channel={isMaster ? 'master' : undefined}
      data-testid={`channel-${ch.id}`}
    >
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'border px-snug text-xs font-mono text-signal-400 tracking-xs shrink-0',
            'border-[var(--color-border)]',
            isMaster
              ? 'border-(color:--color-accent) py-hair font-bold text-(color:--color-accent) tracking-2xl'
              : 'py-px',
          )}
          data-channel={isMaster ? 'master' : undefined}
        >
          {ch.id}
        </span>
        <span className="block text-xs text-signal-400">{ch.name}</span>
        <FaderBar pct={ch.faderPct} bright={ch.focused === true} />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span
          className={cn(
            'font-bold text-base text-(color:--color-text) tracking-xs leading-ratio-1',
            (ch.focused || isMaster) && 'text-(color:--color-accent)',
          )}
        >
          {ch.desktopName ?? ch.name}
        </span>
        <span
          className="text-xs text-signal-400 leading-ratio-1-3 whitespace-nowrap overflow-hidden text-ellipsis max-md:whitespace-normal max-md:overflow-visible max-md:text-clip"
          data-testid="mixer-desc"
        >
          <ParsedText text={ch.desc} />
        </span>
      </div>
      <div className="flex gap-inset items-center justify-center">
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
        'daw-mixer-row-min grid gap-panel-wide items-center px-panel-wide py-3',
        'border-b border-[var(--color-border)]',
        'mx-session-header-tint',
        'text-xs text-signal-400 tracking-3xl',
      )}
      data-testid="session-header"
    >
      <span>
        <SessionSummary mixer={mixer} copy={copy} />
      </span>
      <span className="mixer-transport tabular-nums">
        <span className="transport-play" aria-hidden="true" />
        <span className="text-(color:--color-accent) font-bold text-sm tracking-md">
          {mixer.transportTime}
        </span>
        <span className="text-[var(--color-signal-quiet)]">{copy.transportSeparator}</span>
        <span>
          {mixer.bpm} {copy.bpmUnit}
        </span>
        <span className="text-[var(--color-signal-quiet)]">{copy.transportSeparator}</span>
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
        'text-xs text-signal-400 tracking-5xl uppercase',
        'border-b border-[var(--color-signal-quiet)] px-panel-wide py-chip',
        'bg-(color:--color-surface-tint-medium)',
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
  const endId = useId();
  return (
    <div
      className="daw-mixer-desktop relative font-mono text-sm text-(color:--color-text) border border-[var(--color-border)] bg-(color:--color-surface-tint-medium) overflow-x-auto md:overflow-x-hidden"
      data-testid="daw-mixer-desktop"
    >
      <a href={`#${endId}`} className="mixer-skip-link">
        {copy.skipLabel}
      </a>
      <SessionHeaderDesktop mixer={mixer} copy={copy} />
      <TableHeader copy={copy} />
      {mixer.channels.map((ch) => (
        <ChannelDesktop key={ch.id} ch={ch} copy={copy} />
      ))}
      <div id={endId} tabIndex={-1} />
    </div>
  );
}
