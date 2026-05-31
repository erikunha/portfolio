// WindowChrome — pure RSC, NO 'use client'.
// Renders the three macOS-style traffic-light dots (red/yellow/green).
// Dots are purely decorative: aria-hidden="true", no focus management.
// The size prop sets dot diameter in px (defaults to 10). Callers that need
// a specific context size (9px mobile, 10px shell, 12px desktop) pass it
// explicitly so the primitive stays context-aware without conditional logic.
import type { ComponentPropsWithoutRef } from 'react';
import { cx } from '../../lib/cx';
import styles from './WindowChrome.module.css';

export type WindowChromeProps = ComponentPropsWithoutRef<'div'> & {
  /** Dot diameter in px. Defaults to 10. */
  size?: number;
};

export function WindowChrome({ size = 10, className, style, ...rest }: WindowChromeProps) {
  return (
    <div
      className={cx(styles.root, className)}
      style={{ '--wc-dot-size': `${size}px`, ...style } as React.CSSProperties}
      {...rest}
    >
      <span aria-hidden="true" className={cx(styles.dot, styles.dotRed)} data-dot="red" />
      <span aria-hidden="true" className={cx(styles.dot, styles.dotYellow)} data-dot="yellow" />
      <span aria-hidden="true" className={cx(styles.dot, styles.dotGreen)} data-dot="green" />
    </div>
  );
}
