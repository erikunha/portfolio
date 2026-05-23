import type { ReactNode } from 'react';
import styles from './CmdLine.module.css';

type CmdLineProps = { user?: string; command: string; output?: ReactNode; prompt?: string };

export function CmdLine({
  user = 'erik@portfolio',
  command,
  output,
  prompt = ':~$',
}: CmdLineProps) {
  return (
    <div className={styles.root}>
      <div className={styles.prompt}>
        <span className={styles.user}>{user}</span>
        <span className={styles.sep}>{prompt}</span>
        <span className={styles.cmd}>{command}</span>
      </div>
      {output && <div className={styles.output}>{output}</div>}
    </div>
  );
}
