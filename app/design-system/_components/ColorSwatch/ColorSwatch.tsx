import colorTokens from '../../../../design-system/tokens/color.json';
import { resolveValue } from '../../_lib/resolve-tokens';

type Props = { token: string; usage?: string };

export function ColorSwatch({ token, usage }: Props) {
  const entry = colorTokens[token as keyof typeof colorTokens];
  if (!entry) return null;
  const resolved = resolveValue(entry.$value, colorTokens as Parameters<typeof resolveValue>[1]);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-default last:border-0">
      <div
        className="w-8 h-8 flex-shrink-0 border border-border-default"
        style={{ background: resolved }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <code className="text-[10px] font-mono text-text-muted tracking-widest">--{token}</code>
        <span className="text-xs font-mono text-text-body">{resolved}</span>
        {usage && <span className="text-[10px] font-mono text-text-faint">{usage}</span>}
      </div>
    </div>
  );
}
