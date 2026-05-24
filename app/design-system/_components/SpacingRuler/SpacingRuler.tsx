import spaceTokens from '../../../../design-system/tokens/space.json';
import { resolveValue } from '../../_lib/resolve-tokens';
import styles from './SpacingRuler.module.css';

type Props = { token: string; usage?: string };

const MAX_BAR_PX = 320;

export function SpacingRuler({ token, usage }: Props) {
  const entry = spaceTokens[token as keyof typeof spaceTokens];
  if (!entry) return null;
  const resolved = resolveValue(entry.$value, spaceTokens as Parameters<typeof resolveValue>[1]);
  const numericPx = Number.parseInt(resolved, 10);
  const barWidth = Number.isNaN(numericPx) ? '100%' : `${Math.min(numericPx, MAX_BAR_PX)}px`;

  return (
    <div className={styles.row}>
      <div className={styles.labels}>
        <code className={styles.name}>--{token}</code>
        <span className={styles.value}>{resolved}</span>
        {usage && <span className={styles.usage}>{usage}</span>}
      </div>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: barWidth }} aria-hidden="true" />
      </div>
    </div>
  );
}
