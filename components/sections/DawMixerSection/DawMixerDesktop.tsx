import { FaderDbIsland } from '@/components/client/DawMixer/FaderIsland/FaderDbIsland.client';
import { KnobIsland } from '@/components/client/DawMixer/KnobIsland/KnobIsland.client';
import { RmsButtons } from '@/components/client/DawMixer/RmsButtons/RmsButtons.client';
import { VuMeter } from '@/components/client/DawMixer/VuMeter/VuMeter.client';
import { dawMixer } from '@/content/daw-mixer';
import type { DawMixer, DawMixerChannel } from '@/content/schemas';
import { cn } from '@/lib/cn';

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
    <div className="flex items-stretch gap-1">
      {plugins.map((p) => (
        <div
          key={p.name}
          className={cn(
            'flex-1 min-w-0 border flex flex-col items-center gap-1',
            'px-1 pt-[5px] pb-[6px] text-primary-400 relative',
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
          <span className="text-xs font-bold tracking-[0.06em] whitespace-nowrap overflow-hidden text-ellipsis max-w-full uppercase">
            {p.name}
          </span>
          <span className="flex gap-px items-end" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => {
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
  const isMaster = ch.id === 'MASTER';
  return (
    <div
      className={cn(
        /* 8-column grid defined in components.css */
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
      {/* ID column */}
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
      {/* Track column */}
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
      {/* I/O column (knobs) */}
      <div className="flex gap-[10px] items-center justify-center">
        <KnobIsland initialAngle={ch.knob1.angleDeg} label={ch.knob1.label} channelName={ch.name} />
        <KnobIsland initialAngle={ch.knob2.angleDeg} label={ch.knob2.label} channelName={ch.name} />
      </div>
      {/* R/M/S column */}
      <div className="flex justify-center">
        <RmsButtons buttons={ch.buttons} initialActive={ch.activeButtons} channelName={ch.name} />
      </div>
      {/* Plugin chain column */}
      <div className="min-w-0">
        <PluginChain plugins={ch.plugins} channelId={ch.id} />
      </div>
      {/* Meter column */}
      <div className="p-0">
        <VuMeter
          segments={12}
          initialLevel={ch.meterPct}
          clipping={ch.meterClipping ?? false}
          channelName={ch.name}
        />
      </div>
      {/* Fader + dB island (handles both fader column and dB column internally) */}
      <FaderDbIsland initialPct={ch.faderPct} channelName={ch.name} footer={ch.footer} />
    </div>
  );
}

function SessionHeaderDesktop({ mixer }: { mixer: DawMixer }) {
  return (
    <div
      className={cn(
        'grid gap-[18px] items-center px-[18px] py-3',
        'border-b border-[var(--color-primary-border)]',
        'bg-[color-mix(in_srgb,var(--color-primary-500)_5%,transparent)]',
        'text-xs text-primary-400 tracking-[0.14em]',
      )}
      style={{ gridTemplateColumns: '1fr auto' }}
      data-testid="session-header"
    >
      <span>
        {'SESSION: '}
        <strong className="text-primary-500">{mixer.sessionName}</strong>
        {' · '}
        {mixer.channels.length - 1}
        {' GTR TRACKS + MASTER · '}
        <span className="text-primary-500">{mixer.status}</span>
      </span>
      <span className="inline-flex items-center gap-[14px] tabular-nums">
        {/* Play triangle — complex border-trick, named class */}
        <span className="transport-play" aria-hidden="true" />
        <span className="text-primary-500 font-bold text-sm tracking-[0.06em]">
          {mixer.transportTime}
        </span>
        <span className="text-[var(--color-primary-quiet)]">|</span>
        <span>{mixer.bpm} BPM</span>
        <span className="text-[var(--color-primary-quiet)]">|</span>
        <span>{mixer.timeSignature}</span>
      </span>
    </div>
  );
}

function TableHeader() {
  return (
    <div
      className={cn(
        'daw-channel-row',
        'text-xs max-md:text-[10px] text-primary-400 tracking-[0.18em] uppercase',
        'border-b border-[var(--color-primary-quiet)] px-[18px] py-[7px]',
        'bg-black/50',
      )}
      aria-hidden="true"
    >
      <div>ID</div>
      <div>TRACK</div>
      <div>I/O</div>
      <div>R/M/S</div>
      <div>PLUGIN CHAIN</div>
      <div>METER</div>
      <div>FADER</div>
      <div className="text-right">dB</div>
    </div>
  );
}

export function DawMixerDesktop() {
  return (
    <div
      className="font-mono text-sm text-tertiary-50 border border-[var(--color-primary-border)] bg-black/50 overflow-hidden min-h-[520px]"
      data-testid="daw-mixer-desktop"
    >
      <SessionHeaderDesktop mixer={dawMixer} />
      <TableHeader />
      {dawMixer.channels.map((ch) => (
        <ChannelDesktop key={ch.id} ch={ch} />
      ))}
    </div>
  );
}
