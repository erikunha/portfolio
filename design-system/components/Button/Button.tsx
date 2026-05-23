import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type AsButton = ButtonBaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };
type AsAnchor = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; disabled?: boolean };
type ButtonProps = AsButton | AsAnchor;

export function Button({
  variant = 'primary',
  size = 'md',
  as = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = cx(styles.root, styles[variant], styles[size], className);
  if (as === 'a') {
    const { disabled, ...anchorRest } = rest as AsAnchor;
    return <a className={classes} aria-disabled={disabled ? 'true' : undefined} {...anchorRest} />;
  }
  return <button type="button" className={classes} {...(rest as AsButton)} />;
}
