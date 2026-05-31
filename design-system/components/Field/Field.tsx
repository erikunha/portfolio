'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type FieldBase = { name: string; label: string; error?: string };
export type SingleLineProps = FieldBase &
  InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
export type MultiLineProps = FieldBase &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true; rows?: number };
export type FieldProps = SingleLineProps | MultiLineProps;

const inputClasses =
  'field-input w-full bg-transparent border border-border-default text-text-body font-mono text-xs px-[10px] py-2 min-h-11 resize-y transition-[border-color] duration-200 ease-out placeholder:text-signal placeholder:opacity-60 focus-visible:border-signal aria-[invalid=true]:border-error';

export function Field({
  name,
  label,
  error,
  multiline,
  id: consumerId,
  className: consumerClassName,
  ...rest
}: FieldProps) {
  const id = consumerId ?? `field-${name}`;
  const errId = error ? `${id}-error` : undefined;
  const consumerDescribedBy = (rest as { 'aria-describedby'?: string })['aria-describedby'];
  const describedBy = [consumerDescribedBy, errId].filter(Boolean).join(' ') || undefined;
  const inputProps = {
    id,
    name,
    className: cn(inputClasses, consumerClassName),
    ...(error ? { 'aria-invalid': 'true' as const } : {}),
    'aria-describedby': describedBy,
  };
  return (
    <div className="field flex flex-col gap-[6px]">
      <label htmlFor={id} className="text-xs text-text-muted tracking-[0.08em]">
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
        <span id={errId} className="field-error text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
}
