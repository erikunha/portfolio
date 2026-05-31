import spaceTokens from '../../../../design-system/tokens/space.json';
import { resolveValue } from '../../_lib/resolve-tokens';

type Props = { token: string; usage?: string };

const MAX_BAR_PX = 320;

export function SpacingRuler({ token, usage }: Props) {
  const entry = spaceTokens[token as keyof typeof spaceTokens];
  if (!entry) return null;
  const resolved = resolveValue(entry.$value, spaceTokens as Parameters<typeof resolveValue>[1]);
  const numericPx = Number.parseInt(resolved, 10);
  const barWidth = Number.isNaN(numericPx) ? '100%' : `${Math.min(numericPx, MAX_BAR_PX)}px`;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-default last:border-0">
      <div className="flex flex-col gap-0.5 min-w-[140px]">
        <code className="text-[10px] font-mono text-text-muted tracking-widest">--{token}</code>
        <span className="text-xs font-mono text-text-body">{resolved}</span>
        {usage && <span className="text-[10px] font-mono text-text-faint">{usage}</span>}
      </div>
      <div className="flex-1 h-3 bg-surface border border-border-default relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-signal-quiet border-r border-signal"
          style={{ width: barWidth }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
