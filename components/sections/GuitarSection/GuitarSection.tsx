import Image from 'next/image';
import { Suspense } from 'react';
import { guitarRig } from '@/content/guitar-rig';
import type { GuitarRig } from '@/content/schemas';
import { cn } from '@/lib/cn';
import { getIsMobile } from '@/lib/ua';
import { IconGuitar } from '../../Icons';
import { Module } from '../../responsive/Module';

type Block = Extract<GuitarRig['signalChain'][number], { role: 'FX' }>['blocks'][number];
type Influence = GuitarRig['influences'][number];

function SignalBars({ filled, total }: { filled: number; total: number }) {
  const bars = Array.from({ length: total }, (_, i) => ({
    cls: cn(
      'w-[7px] h-[10px] md:w-[9px] md:h-[13px] shrink-0 bg-primary-500',
      i >= filled && 'opacity-[0.22]',
    ),
  }));
  return (
    <div role="img" className="flex gap-[2px] mt-auto" aria-label={`${filled} of ${total}`}>
      {bars.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional bars — no stable id exists
        <span key={i} className={b.cls} />
      ))}
    </div>
  );
}

function InfluenceBars({ filled }: { filled: number }) {
  const bars = Array.from({ length: 5 }, (_, i) => ({
    cls: cn('block w-[7px] h-[12px] bg-primary-500', i >= filled && 'opacity-[0.22]'),
  }));
  return (
    <span className="inline-flex gap-[2px]" aria-hidden="true">
      {bars.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional bars
        <span key={i} className={b.cls} />
      ))}
    </span>
  );
}

function FxGrid({ blocks }: { blocks: Block[] }) {
  return (
    <div className="grid grid-cols-4 gap-1 mt-[6px]">
      {blocks.map((b) => (
        <div
          key={b.name}
          className={cn(
            'py-[5px] text-[13px] text-center tracking-[0.1em]',
            b.active
              ? [
                  'border border-primary-500 text-primary-500 relative font-bold',
                  'bg-[color-mix(in_srgb,var(--color-primary-500)_8%,transparent)]',
                ].join(' ')
              : 'border border-[var(--color-primary-quiet)] text-primary-400 bg-black/40',
          )}
        >
          {b.name}
          {b.active && (
            <span
              className="absolute top-[3px] right-[3px] w-1 h-1 rounded-full bg-primary-500 text-[0px] block"
              aria-hidden="true"
              data-testid="fx-bullet"
            >
              ●
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function FxList({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-[10px] mt-[6px]" data-testid="fx-list">
      {blocks.map((b) => (
        <div
          key={b.name}
          className={cn(
            'flex gap-2 items-center text-xs px-2 py-[11px]',
            b.active
              ? [
                  'border border-primary-500 text-primary-500',
                  'bg-[color-mix(in_srgb,var(--color-primary-500)_8%,transparent)]',
                ].join(' ')
              : 'border border-primary-subtle text-primary-400',
          )}
        >
          <span aria-hidden="true">{b.active ? '●' : '○'}</span>
          <span>{b.name}</span>
        </div>
      ))}
    </div>
  );
}

function InfluencesList({
  influences,
  nowObsessing,
}: {
  influences: Influence[];
  nowObsessing: string;
}) {
  return (
    <div className="border border-[var(--color-primary-border)] bg-black/35 p-[14px]">
      <div className="flex justify-between text-xs text-primary-400 tracking-[0.16em] mb-3">
        <span>
          {'INFLUENCES.QUEUE · '}
          <span className="text-primary-500">{influences.length} LOADED</span>
        </span>
        <span>{'// SHUFFLE OFF'}</span>
      </div>
      {influences.map((inf) => (
        <div
          key={inf.rank}
          className={cn(
            'grid grid-cols-[36px_1fr_auto] gap-[10px] items-center mb-[9px]',
            'text-tertiary-50 text-xs',
            inf.active && 'text-primary-500 font-bold',
          )}
          data-active={inf.active || undefined}
        >
          <span className="text-primary-400 text-xs tracking-[0.1em]">
            {inf.active ? '▶ ' : ''}
            {String(inf.rank).padStart(2, '0')}
          </span>
          <span className={cn('font-mono md:text-sm', inf.active && 'md:text-[15px]')}>
            {inf.name}
          </span>
          <InfluenceBars filled={inf.strength} />
        </div>
      ))}
      <div className="mt-3 pt-[10px] border-t border-dashed border-[var(--color-primary-quiet)] text-[10px] md:text-[13px] text-primary-400">
        <strong className="text-primary-500 font-bold">now obsessing:</strong> {nowObsessing}
      </div>
    </div>
  );
}

function LiveCam({ liveCam }: { liveCam: GuitarRig['liveCam'] }) {
  return (
    <div className="border border-primary-500 flex flex-col overflow-hidden">
      <div className="flex justify-between px-[9px] py-[6px] max-md:px-[7px] max-md:py-1 text-xs max-md:text-[10px] text-primary-400 bg-black/60 tracking-[0.12em] border-b border-[var(--color-primary-quiet)]">
        <span>{liveCam.status}</span>
        <span>{liveCam.cameraLabel}</span>
      </div>
      <div className="guitar-content relative min-h-[200px] max-md:min-h-[140px] overflow-hidden flex-1 isolate">
        <Image
          src={liveCam.photo}
          alt="Erik playing guitar on stage, live show"
          fill
          className="object-cover grayscale contrast-[1.18] brightness-95"
          sizes="(max-width: 768px) min(100vw, 800px), 320px"
        />
        <div
          className="absolute inset-0 bg-primary-500 mix-blend-multiply opacity-60 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(0,0,0,0.3)_0_1px,transparent_1px_3px)] pointer-events-none"
          aria-hidden="true"
        />
        <div className="guitar-scan-beam" aria-hidden="true" />
        <div className="cam-corners" aria-hidden="true">
          <i />
        </div>
      </div>
      <div className="px-[9px] py-[6px] max-md:px-[7px] max-md:py-1 text-xs max-md:text-[10px] text-primary-400 bg-black/65 tracking-[0.12em] border-t border-[var(--color-primary-quiet)]">
        {liveCam.caption}
      </div>
    </div>
  );
}

export function GuitarDesktop() {
  const { signalChain, influences, nowObsessing, stats, liveCam } = guitarRig;
  return (
    <div
      className="flex flex-col gap-4 font-mono text-sm text-tertiary-50"
      data-testid="guitar-desktop"
    >
      <div className="border border-[var(--color-primary-border)] bg-black/35 p-[14px]">
        <div className="flex justify-between text-xs text-primary-400 tracking-[0.16em] mb-3 font-bold">
          <span>
            <span className="text-primary-500" aria-hidden="true">
              ●
            </span>
            {' SIGNAL_CHAIN.LIVE · SIGNAL OK'}
          </span>
          <span>TAIL -F ~/.RIG</span>
        </div>
        <div
          className="grid items-stretch gap-[6px]"
          style={{ gridTemplateColumns: '1.05fr 26px 1.4fr 26px 1fr 26px 0.85fr' }}
        >
          {signalChain.flatMap((node, i) => {
            const nodeEl = (
              <div
                key={node.role}
                className={cn(
                  'border border-primary-500 flex flex-col gap-[5px]',
                  'px-3 pt-[10px] pb-3 min-h-[124px]',
                  node.role === 'FX'
                    ? 'bg-[color-mix(in_srgb,var(--color-primary-500)_8%,transparent)]'
                    : 'bg-[color-mix(in_srgb,var(--color-primary-500)_4%,transparent)]',
                )}
                data-testid={`signal-node-${node.role}`}
              >
                <div
                  className="text-xs text-primary-400 tracking-[0.04em]"
                  data-testid="node-label"
                >
                  {'// '}
                  {node.role}
                </div>
                <div className="font-bold text-sm text-primary-500 leading-[1.2]">{node.name}</div>
                <div className="text-[13px] text-tertiary-50 opacity-85">{node.subtitle}</div>
                {node.role === 'FX' ? (
                  <FxGrid blocks={node.blocks} />
                ) : (
                  <SignalBars filled={node.strengthDots} total={8} />
                )}
              </div>
            );
            if (i === 0) return [nodeEl];
            const arrowKey = `arrow-${i}`;
            const arrowEl = (
              <span
                key={arrowKey}
                className="signal-chain-arrow self-center justify-self-center text-primary-500 [text-shadow:0_0_6px_var(--color-primary-500)] text-[13px]"
                aria-hidden="true"
              />
            );
            return [arrowEl, nodeEl];
          })}
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
        <InfluencesList influences={influences} nowObsessing={nowObsessing} />
        <LiveCam liveCam={liveCam} />
      </div>
      <div className="grid grid-cols-4 gap-px bg-[var(--color-primary-quiet)] border border-[var(--color-primary-quiet)]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-black px-[13px] pt-[11px] pb-[13px]"
            data-testid={`stat-${stat.label}`}
          >
            <div className="text-xs text-primary-400 tracking-[0.04em] mb-1">
              {'// '}
              {stat.label}
            </div>
            <div className="font-bold text-primary-500 text-sm leading-[1.4]">{stat.value}</div>
            <div className="text-sm text-tertiary-50 leading-[1.4]">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuitarMobile() {
  const { signalChain, influences, nowObsessing, stats, liveCam } = guitarRig;
  return (
    <div
      className="flex flex-col gap-3 font-mono text-xs text-tertiary-50"
      data-testid="guitar-mobile"
    >
      <div className="border border-[var(--color-primary-border)] bg-black/35 p-[10px]">
        <div className="text-xs text-primary-400 mb-[10px] leading-[1.7]">
          <div>
            <span className="text-primary-500" aria-hidden="true">
              ●
            </span>
            {' SIGNAL_CHAIN.LIVE · SIGNAL OK'}
          </div>
          <div>TAIL -F ~/.RIG</div>
        </div>
        {signalChain.map((node, i) => (
          <div key={node.role}>
            {i > 0 && (
              <div
                className="text-center py-[5px] text-primary-500 text-xs [text-shadow:0_0_6px_var(--color-primary-500)]"
                aria-hidden="true"
              >
                ▼
              </div>
            )}
            <div
              className="border border-primary-500 bg-[color-mix(in_srgb,var(--color-primary-500)_4%,transparent)] p-[10px] flex flex-col gap-1"
              data-testid={`signal-node-mobile-${node.role}`}
            >
              <div className="text-xs text-primary-400 tracking-[0.04em]">
                {'// '}
                {node.role}
              </div>
              <div className="font-bold text-xs max-md:text-sm text-primary-500 leading-[1.2]">
                {node.name}
              </div>
              <div className="text-xs text-tertiary-50 opacity-85">{node.subtitle}</div>
              {node.role === 'FX' ? (
                <FxList blocks={node.blocks} />
              ) : (
                <SignalBars filled={node.strengthDots} total={8} />
              )}
            </div>
          </div>
        ))}
      </div>
      <InfluencesList influences={influences} nowObsessing={nowObsessing} />
      <LiveCam liveCam={liveCam} />
      <div className="grid grid-cols-2 gap-px bg-[var(--color-primary-quiet)] border border-[var(--color-primary-quiet)]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-black px-[13px] pt-[11px] pb-[13px]"
            data-testid={`stat-mobile-${stat.label}`}
          >
            <div className="text-xs max-md:text-[10px] text-primary-400 tracking-[0.04em] mb-1">
              {'// '}
              {stat.label}
            </div>
            <div className="font-bold text-primary-500 text-xs max-md:text-[12px] leading-[1.4]">
              {stat.value}
            </div>
            <div className="text-xs max-md:text-[10px] text-tertiary-50 leading-[1.4]">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function GuitarContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <GuitarMobile /> : <GuitarDesktop />;
}

export function GuitarSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-guitar"
      header="CAT ~/.GUITAR_RIG"
      icon={<IconGuitar />}
      defer={defer}
      variant="green"
    >
      <Suspense fallback={null}>
        <GuitarContent />
      </Suspense>
    </Module>
  );
}
