import type { ReactNode } from 'react';
import { TerminalPanel } from '@/design-system';
import styles from './Preview.module.css';

type PreviewProps = {
  source?: string;
  children: ReactNode;
};

export function Preview({ source, children }: PreviewProps) {
  return (
    <div data-testid="ds-preview">
      <TerminalPanel className={styles.root ?? ''}>
        <div className={styles.live}>{children}</div>
        {source != null && (
          <details className={styles.sourceToggle}>
            <summary className={styles.summary}>VIEW SOURCE</summary>
            <pre className={styles.source}>
              <code>{source}</code>
            </pre>
          </details>
        )}
      </TerminalPanel>
    </div>
  );
}
