import typographyTokens from '../../../../design-system/tokens/typography.json';
import { resolveValue } from '../../_lib/resolve-tokens';

type Props = { token: string };

export function TypeSpecimen({ token }: Props) {
  const entry = typographyTokens[token as keyof typeof typographyTokens];
  if (!entry) return null;
  const resolved = resolveValue(
    entry.$value as string,
    typographyTokens as Parameters<typeof resolveValue>[1],
  );

  return (
    <div className="flex items-baseline gap-4 py-2 border-b border-border-default last:border-0">
      <div
        className="text-signal font-mono flex-shrink-0 w-16 overflow-hidden leading-none"
        style={{ fontSize: resolved }}
        aria-hidden="true"
      >
        Aa
      </div>
      <div className="flex flex-col gap-0.5">
        <code className="text-[10px] font-mono text-text-muted tracking-widest">--{token}</code>
        <span className="text-xs font-mono text-text-body">{resolved}</span>
      </div>
    </div>
  );
}
