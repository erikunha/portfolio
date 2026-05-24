import typographyTokens from '../../../../design-system/tokens/typography.json';
import { resolveValue } from '../../_lib/resolve-tokens';
import styles from './TypeSpecimen.module.css';

type Props = { token: string };

export function TypeSpecimen({ token }: Props) {
  const entry = typographyTokens[token as keyof typeof typographyTokens];
  if (!entry) return null;
  const resolved = resolveValue(
    entry.$value as string,
    typographyTokens as Parameters<typeof resolveValue>[1],
  );

  return (
    <div className={styles.row}>
      <div className={styles.specimen} style={{ fontSize: resolved }} aria-hidden="true">
        Aa
      </div>
      <div className={styles.meta}>
        <code className={styles.name}>--{token}</code>
        <span className={styles.value}>{resolved}</span>
      </div>
    </div>
  );
}
