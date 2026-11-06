import type { CSSProperties } from 'react';
import { pctToDb } from '@/components/client/DawMixer/FaderIsland/pct-to-db';
import {
  type DawMixerCopy,
  dawMixer,
  dawMixerCopy,
  MASTER_CHANNEL_ID,
  METER_CLIP_SEGMENTS,
  METER_CLIP_THRESHOLD_PCT,
  METER_SEGMENTS,
} from '@/content/daw-mixer';
import type { DawMixer, DawMixerChannel } from '@/content/schemas';
import type { SiteLocale } from '@/content/site-locale';
import { cn } from '@/lib/cn';
import { getIsMobile } from '@/lib/ua';
import {
  DawMixerDesktop,
  FaderBar,
  ParsedText,
  SessionSummary,
  StrengthDots,
} from './DawMixerDesktop';

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
    <div
      className="flex gap-px h-3 p-px border border-[var(--color-primary-quiet)] bg-black/70"
      aria-hidden="true"
    >
      {Array.from({ length: segments }, (_, i) => {
        const isRed =
          clipping &&
          pct > METER_CLIP_THRESHOLD_PCT &&
          i >= segments - METER_CLIP_SEGMENTS &&
          i < filledCount;
        const cls = cn(
          'flex-1 h-full',
          isRed
            ? 'bg-senary-300'
            : i < filledCount
              ? 'bg-primary-500'
              : 'bg-primary-500 opacity-[0.22]',
        );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional segments, no stable id exists
          <span key={i} className={cls} />
        );
      })}
    </div>
  );
}

function StaticFader({ pct }: { pct: number }) {
  return (
    <div className="mx-fader" aria-hidden="true">
      <div
        className={cn(
          'absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-[18px] h-[28px]',
          'bg-primary-500 shadow-[0_0_10px_var(--color-primary-500)] border border-black',
          'motion-reduce:shadow-none',
          'mx-fader-thumb',
        )}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function StaticKnob({ angleDeg, label }: { angleDeg: number; label: string }) {
  return (
    <div className="flex flex-row items-center gap-2 select-none">
      <div
        className={cn(
          'w-[30px] h-[30px] border border-primary-500 rounded-full relative shrink-0',
          'bg-[radial-gradient(circle_at_35%_30%,var(--color-glow-18),rgba(0,0,0,0.7))]',
          'mx-dial',
        )}
        style={{ '--mx-knob-angle': `${angleDeg}deg` } as CSSProperties}
        aria-hidden="true"
      />
      <span className="text-xs tracking-[0.1em] text-primary-400 uppercase font-bold">{label}</span>
    </div>
  );
}

function PluginChainMobile({
  plugins,
  channelId,
  copy,
}: {
  plugins: DawMixerChannel['plugins'];
  channelId: string;
  copy: DawMixerCopy;
}) {
  return (
    <div className="mx-chain-wrap mb-[2px]" aria-hidden="true">
      <div className="text-xs tracking-[0.18em] text-primary-400 uppercase mb-[5px] flex items-center gap-[6px] mx-chain-title">
        {copy.signalFlow}
      </div>
      <div className="mx-chain mx-chain-mobile">
        {plugins.map((p) => (
          <div
            key={p.name}
            className={cn(
              'grid items-center gap-2 border px-[10px] py-2 relative',
              'text-primary-400',
              p.active
                ? [
                    'border-primary-500 text-primary-500',
                    'bg-[color-mix(in_srgb,var(--color-primary-500)_8%,transparent)]',
                  ].join(' ')
                : 'border-[color-mix(in_srgb,var(--color-primary-quiet)_40%,transparent)]',
            )}
            style={{ gridTemplateColumns: '14px minmax(90px, auto) 1fr' }}
            data-testid={`plugin-mobile-${channelId}-${p.name}`}
          >
            <span
              className={cn(
                'w-[6px] h-[6px] justify-self-center',
                p.active
                  ? 'bg-primary-500 shadow-[0_0_4px_var(--color-primary-500)]'
                  : 'bg-[var(--color-primary-quiet)]',
              )}
              aria-hidden="true"
            />
            <span className="text-xs font-bold tracking-[0.08em] uppercase leading-none whitespace-nowrap">
              {p.name}
            </span>
            <span
              className={cn('flex gap-[2px] items-end h-[7px]', !p.active && 'opacity-40')}
              aria-hidden="true"
            >
              <StrengthDots strength={p.strength} dotClassName="w-1 h-[6px]" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionHeaderMobile({ mixer, copy }: { mixer: DawMixer; copy: DawMixerCopy }) {
  return (
    <div
      className="text-xs text-primary-400 leading-[1.8] border-b border-[var(--color-primary-border)] px-[14px] py-[10px] tracking-[0.14em] bg-[color-mix(in_srgb,var(--color-primary-500)_5%,transparent)]"
      data-testid="session-header-mobile"
    >
      <div>
        <SessionSummary mixer={mixer} copy={copy} />
      </div>
      <div>
        {copy.playGlyph} {mixer.transportTime} {copy.transportSeparator} {mixer.bpm} {copy.bpmUnit}{' '}
        {copy.transportSeparator} {mixer.timeSignature}
      </div>
    </div>
  );
}

function MixLegendMobile({ mixer, copy }: { mixer: DawMixer; copy: DawMixerCopy }) {
  const lead = mixer.channels.find((ch) => ch.focused && ch.id !== MASTER_CHANNEL_ID);
  if (!lead) return null;
  return (
    <div
      className="flex flex-col gap-[3px] px-[14px] py-2 border-b border-[var(--color-primary-quiet)] bg-black/60 text-xs tracking-[0.16em] text-primary-400 uppercase"
      aria-hidden="true"
    >
      <span>
        <span className="inline-block w-[5px] h-[5px] bg-primary-500 shadow-[0_0_5px_var(--color-primary-500)] mr-[6px] align-[1px]" />
        {lead.id} {copy.leadSuffix}
      </span>
    </div>
  );
}

function ChannelMobile({ ch, copy }: { ch: DawMixerChannel; copy: DawMixerCopy }) {
  const isMaster = ch.id === MASTER_CHANNEL_ID;
  return (
    <div
      className={cn(
        'relative border-b border-[var(--color-primary-quiet)] px-[14px] pt-4 pb-[18px] flex flex-col gap-3',
        ch.focused
          ? 'bg-[color-mix(in_srgb,var(--color-primary-500)_7%,transparent)] channel-row-focused'
          : 'bg-black/35',
        isMaster && [
          'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary-500)_6%,transparent),transparent)]',
          'border-t-2 border-t-primary-500',
        ],
      )}
      data-focused={ch.focused || undefined}
      data-channel={isMaster ? 'master' : undefined}
      data-testid={`channel-mobile-${ch.id}`}
    >
      <div
        className="grid items-center gap-[10px]"
        style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }}
      >
        <span
          className={cn(
            'text-xs tracking-[0.18em] border font-bold whitespace-nowrap shrink-0 px-[7px] py-[3px]',
            ch.focused
              ? 'text-primary-500 border-primary-500 bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)]'
              : 'text-primary-400 border-[var(--color-primary-quiet)] bg-black/55',
            isMaster &&
              'border-primary-500 px-2 py-[2px] text-xs tracking-[0.12em] font-bold text-primary-500 bg-transparent',
          )}
          data-channel={isMaster ? 'master' : undefined}
        >
          {ch.id}
        </span>
        <span
          className={cn(
            'text-sm font-bold tracking-[0.04em] leading-[1.15] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap',
            ch.focused || isMaster ? 'text-primary-500' : 'text-tertiary-50',
          )}
        >
          {ch.name}
        </span>
        <div className="text-xs text-primary-400 tabular-nums tracking-[0.04em] text-right leading-[1.1] whitespace-nowrap">
          <span className="font-bold text-primary-500 text-xs max-md:text-sm">
            {pctToDb(ch.faderPct)}
          </span>
          <span className="text-xs max-md:text-sm text-primary-400">{copy.decibelUnit}</span>
        </div>
      </div>
      <div
        className="text-primary-400 text-xs tracking-[0.02em] leading-[1.4]"
        data-testid="mx-ref"
      >
        <ParsedText text={ch.desc} />
      </div>
      <div className="flex flex-col gap-2">
        <StaticMeter
          pct={ch.meterPct}
          segments={METER_SEGMENTS}
          clipping={ch.meterClipping ?? false}
        />
        <StaticFader pct={ch.faderPct} />
      </div>
      <PluginChainMobile plugins={ch.plugins} channelId={ch.id} copy={copy} />
      <div className="flex flex-col gap-[14px] pt-[14px] border-t border-dashed border-[var(--color-primary-quiet)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-[18px]">
            <StaticKnob angleDeg={ch.knob1.angleDeg} label={ch.knob1.label} />
            <StaticKnob angleDeg={ch.knob2.angleDeg} label={ch.knob2.label} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-[6px]">
            {ch.buttons.map((btn) => (
              <div
                key={btn}
                className={cn(
                  'min-w-[32px] h-7 px-[10px] flex items-center justify-center',
                  'text-xs font-bold tracking-[0.04em]',
                  ch.activeButtons.includes(btn)
                    ? [
                        'border border-primary-500 text-primary-500',
                        'bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)]',
                        'shadow-[0_0_5px_var(--color-glow-35)]',
                      ].join(' ')
                    : 'border border-[var(--color-primary-quiet)] text-primary-400 bg-black/50',
                )}
              >
                {btn}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <FaderBar pct={ch.faderPct} />
          {ch.footer && (
            <span className="text-xs text-primary-400 block text-center tracking-[0.08em] opacity-80">
              {copy.loudnessLabel} {ch.footer.lufs} {copy.separator} {copy.peakLabel} {ch.footer.pk}
            </span>
          )}
        </div>
      </div>
      {ch.terminalLines && (
        <div className="border border-[var(--color-primary-quiet)] px-[10px] py-2 mt-1">
          {ch.terminalLines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional terminal lines
            <div key={i} className="text-xs text-primary-400 leading-[1.8]">
              <ParsedText text={line} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DawMixerMobile({ mixer, copy }: { mixer: DawMixer; copy: DawMixerCopy }) {
  return (
    <div
      className="font-mono text-xs text-tertiary-50 flex flex-col"
      data-testid="daw-mixer-mobile"
    >
      <SessionHeaderMobile mixer={mixer} copy={copy} />
      <MixLegendMobile mixer={mixer} copy={copy} />
      {mixer.channels.map((ch) => (
        <ChannelMobile key={ch.id} ch={ch} copy={copy} />
      ))}
    </div>
  );
}

export async function DawMixerContent({ locale }: { locale: SiteLocale }) {
  const isMobile = await getIsMobile();
  const mixer = dawMixer[locale];
  const copy = dawMixerCopy[locale];
  return isMobile ? (
    <DawMixerMobile mixer={mixer} copy={copy} />
  ) : (
    <DawMixerDesktop mixer={mixer} copy={copy} />
  );
}
