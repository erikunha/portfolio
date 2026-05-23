import type { ReactNode } from 'react';
import { TerminalPanel } from '@/design-system';
import styles from './Preview.module.css';

type PreviewProps = {
  source?: string;
  children: ReactNode;
};

export function Preview({ source, children }: PreviewProps) {
  return (
    <TerminalPanel className={styles.root as string}>
      <div className={styles.live as string}>{children}</div>
      {source != null && (
        <details className={styles.sourceToggle as string}>
          <summary className={styles.summary as string}>VIEW SOURCE</summary>
          <pre className={styles.source as string}>
            <code>{source}</code>
          </pre>
        </details>
      )}
    </TerminalPanel>
  );
}
