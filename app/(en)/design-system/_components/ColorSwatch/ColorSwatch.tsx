import { getThemeColors } from '../../_lib/theme-tokens';

type Props = { token: string; usage?: string };

export function ColorSwatch({ token, usage }: Props) {
  const resolved = getThemeColors()[token];
  if (!resolved) return null;

  return (
    <div className="ds-swatch flex items-center gap-3 py-2 border-b border-primary-border last:border-0">
      <div
        className="w-8 h-8 flex-shrink-0 border border-primary-border"
        style={{
          background: `linear-gradient(${resolved}, ${resolved}), var(--color-secondary-950)`,
        }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <code className="text-xs font-mono text-primary-400 tracking-widest">--color-{token}</code>
        <span className="text-xs font-mono text-tertiary-50">{resolved}</span>
        {usage ? <span className="text-xs font-mono text-primary-300">{usage}</span> : null}
      </div>
    </div>
  );
}
