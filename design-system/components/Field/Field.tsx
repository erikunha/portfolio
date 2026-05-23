import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Field.module.css';

export type FieldBase = { name: string; label: string; error?: string };
export type SingleLineProps = FieldBase &
  InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
export type MultiLineProps = FieldBase &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true; rows?: number };
export type FieldProps = SingleLineProps | MultiLineProps;

export function Field({
  name,
  label,
  error,
  multiline,
  className: consumerClassName,
  ...rest
}: FieldProps) {
  const id = `field-${name}`;
  const errId = error ? `${id}-error` : undefined;
  const consumerDescribedBy = (rest as { 'aria-describedby'?: string })['aria-describedby'];
  const describedBy = [consumerDescribedBy, errId].filter(Boolean).join(' ') || undefined;
  const inputProps = {
    id,
    name,
    className: cx(styles.input, consumerClassName),
    'aria-invalid': error ? ('true' as const) : undefined,
    'aria-describedby': describedBy,
  };
  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={(rest as MultiLineProps).rows ?? 4}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          {...inputProps}
        />
      ) : (
        <input {...(rest as InputHTMLAttributes<HTMLInputElement>)} {...inputProps} />
      )}
      {error && (
        <span id={errId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
