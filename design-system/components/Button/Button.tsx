import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export type AsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };
export type AsAnchor = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; href: string; disabled?: boolean };
export type ButtonProps = AsButton | AsAnchor;

export function Button({
  variant = 'primary',
  size = 'md',
  as = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = cx(styles.root, styles[variant], styles[size], className);
  if (as === 'a') {
    const { disabled, href, onClick, tabIndex, ...anchorRest } = rest as AsAnchor;
    return (
      <a
        {...anchorRest}
        className={classes}
        aria-disabled={disabled ? 'true' : undefined}
        href={disabled ? undefined : href}
        tabIndex={disabled ? -1 : tabIndex}
        onClick={disabled ? (e) => e.preventDefault() : onClick}
      />
    );
  }
  const { type = 'button', ...buttonRest } = rest as AsButton;
  return <button className={classes} type={type} {...buttonRest} />;
}
