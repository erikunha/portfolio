import { type DawMixerCopy, PLUGIN_STRENGTH_STEPS } from '@/content/daw-mixer';
import type { DawMixer } from '@/content/schemas';
import { cn } from '@/lib/cn';

export function ParsedText({ text }: { text: string }) {
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

export function StrengthDots({
  strength,
  dotClassName,
}: {
  strength: number;
  dotClassName: string;
}) {
  return Array.from({ length: PLUGIN_STRENGTH_STEPS }, (_, i) => {
    const cls = cn(
      'block bg-(color:--color-accent)',
      i < strength ? 'meter-fill' : 'meter-dim opacity-[0.22]',
      dotClassName,
    );
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: positional strength dots
      <span key={i} className={cls} />
    );
  });
}

export function FaderBar({ pct, bright = false }: { pct: number; bright?: boolean }) {
  return (
    <div
      className="h-pip bg-[var(--color-signal-quiet)] border border-[var(--color-signal-quiet)] relative overflow-hidden"
      aria-hidden="true"
    >
      <div
        className={cn(
          'meter-fill absolute left-0 top-0 bottom-0 bg-(color:--color-accent) opacity-85',
          bright && 'opacity-100',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SessionSummary({ mixer, copy }: { mixer: DawMixer; copy: DawMixerCopy }) {
  return (
    <>
      {copy.sessionLabel}{' '}
      <strong className="text-(color:--color-accent)">{mixer.sessionName}</strong> {copy.separator}{' '}
      {mixer.channels.length - 1} {copy.tracksLabel} {copy.separator}{' '}
      <span className="text-(color:--color-accent)">{mixer.status}</span>
    </>
  );
}
