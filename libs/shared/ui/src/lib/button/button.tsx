/**
 * Button Component
 * Enterprise-grade button with full accessibility support
 * Uses CSS Modules for styling - zero runtime CSS
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

/**
 * Button component - follows WCAG AA accessibility standards
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isFullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const buttonClasses = [
    styles['button'],
    styles[variant],
    styles[size],
    isFullWidth ? styles['fullWidth'] : '',
    isLoading ? styles['loading'] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={buttonClasses}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-disabled={disabled || isLoading}
      {...props}
    >
      {leftIcon && <span className={styles['icon']}>{leftIcon}</span>}
      <span className={styles['label']}>{children}</span>
      {rightIcon && <span className={styles['icon']}>{rightIcon}</span>}
      {isLoading && (
        <span className={styles['spinner']} role="status" aria-live="polite">
          <span className="visually-hidden">Loading</span>
        </span>
      )}
    </button>
  );
}
