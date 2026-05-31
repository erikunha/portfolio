import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

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

const baseClasses =
  'inline-flex items-center justify-content-center px-[14px] border border-signal-subtle text-xs font-bold tracking-[0.1em] uppercase cursor-pointer transition-[box-shadow,background] duration-[var(--ds-duration-base)] ease-out no-underline focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2 aria-disabled:opacity-40 aria-disabled:pointer-events-none disabled:opacity-40 disabled:pointer-events-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-signal text-surface border-signal hover:shadow-[0_0_12px_var(--color-signal)]',
  secondary:
    'bg-transparent text-signal hover:shadow-[0_0_12px_var(--color-signal)] hover:bg-signal-quiet',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9',
  md: 'min-h-11',
  lg: 'min-h-[52px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  as = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
  if (as === 'a') {
    const { disabled, href, onClick, tabIndex, ...anchorRest } = rest as AsAnchor;
    return (
      <a
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
  return <button className={classes} type={type} {...buttonRest} />;
}
