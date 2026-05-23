import type { ReactNode } from 'react';
import { Sidebar } from './_components/Sidebar.client';
import styles from './layout.module.css';

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <Sidebar />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
