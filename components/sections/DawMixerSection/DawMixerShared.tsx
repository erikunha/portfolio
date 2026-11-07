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
    const cls = cn('block bg-primary-500', dotClassName, i >= strength && 'opacity-[0.22]');
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: positional strength dots
      <span key={i} className={cls} />
    );
  });
}

export function FaderBar({ pct, bright = false }: { pct: number; bright?: boolean }) {
  return (
    <div
      className="h-[6px] bg-[var(--color-primary-quiet)] border border-[var(--color-primary-quiet)] relative overflow-hidden"
      aria-hidden="true"
    >
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 bg-primary-500 opacity-85',
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
      {copy.sessionLabel} <strong className="text-primary-500">{mixer.sessionName}</strong>{' '}
      {copy.separator} {mixer.channels.length - 1} {copy.tracksLabel} {copy.separator}{' '}
      <span className="text-primary-500">{mixer.status}</span>
    </>
  );
}
