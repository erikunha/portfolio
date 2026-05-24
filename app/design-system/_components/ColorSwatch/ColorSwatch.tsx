import colorTokens from '../../../../design-system/tokens/color.json';
import { resolveValue } from '../../_lib/resolve-tokens';
import styles from './ColorSwatch.module.css';

type Props = { token: string; usage?: string };

export function ColorSwatch({ token, usage }: Props) {
  const entry = colorTokens[token as keyof typeof colorTokens];
  if (!entry) return null;
  const resolved = resolveValue(entry.$value, colorTokens as Parameters<typeof resolveValue>[1]);

  return (
    <div className={styles.row}>
      <div className={styles.swatch} style={{ background: resolved }} aria-hidden="true" />
      <div className={styles.meta}>
        <code className={styles.name}>--{token}</code>
        <span className={styles.value}>{resolved}</span>
        {usage && <span className={styles.usage}>{usage}</span>}
      </div>
    </div>
  );
}
