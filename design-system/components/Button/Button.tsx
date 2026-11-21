import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { joinClassNames } from '@/lib/join-class-names';

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
  const classes = joinClassNames('btn', className);
  if (as === 'a') {
    const { disabled, href, onClick, tabIndex, ...anchorRest } = rest as AsAnchor;
    return (
      <a
        data-variant={variant}
        data-size={size}
        {...anchorRest}
        className={classes}
        {...(disabled ? { 'aria-disabled': 'true' as const } : {})}
        href={disabled ? undefined : href}
        tabIndex={disabled ? -1 : tabIndex}
        onClick={disabled ? (e) => e.preventDefault() : onClick}
      />
    );
  }
  const { type = 'button', ...buttonRest } = rest as AsButton;
  return (
    <button
      data-variant={variant}
      data-size={size}
      className={classes}
      type={type}
      {...buttonRest}
    />
  );
}
