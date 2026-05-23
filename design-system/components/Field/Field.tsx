import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './Field.module.css';

export type FieldBase = { name: string; label: string; error?: string };
export type SingleLineProps = FieldBase &
  InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
export type MultiLineProps = FieldBase &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true; rows?: number };
export type FieldProps = SingleLineProps | MultiLineProps;

export function Field({ name, label, error, multiline, ...rest }: FieldProps) {
  const id = `field-${name}`;
  const errId = error ? `${id}-error` : undefined;
  const inputProps = {
    id,
    name,
    className: styles.input,
    'aria-invalid': error ? ('true' as const) : undefined,
    'aria-describedby': errId,
  };
  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {multiline ? (
        <textarea
          {...inputProps}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={(rest as MultiLineProps).rows ?? 4}
        />
      ) : (
        <input {...inputProps} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error && (
        <span id={errId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
