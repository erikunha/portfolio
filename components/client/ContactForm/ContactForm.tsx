'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CONTACT_DELIVERY_CODE, contactContent } from '@/content/contact';
import { contactChrome } from '@/content/terminal-chrome';
import { WindowChrome } from '@/design-system';
import { Field } from '@/design-system/components/Field';
import {
  CONTACT_FIELD,
  CONTACT_LIMITS,
  type ContactField,
  ContactSchema,
} from '@/lib/contact-validation';

const STATUS = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  QUEUED: 'queued',
  ERROR: 'error',
} as const;
type Status = (typeof STATUS)[keyof typeof STATUS];
const CONTACT_ENDPOINT = '/api/contact';
const QUEUED_STATUS = 202;
const MESSAGE_ROWS = 5;
const INITIAL_FAILURE_COUNT = 0;
const INITIAL_VALUES: Record<ContactField, string> = { name: '', email: '', message: '' };
const CONTACT_FIELDS = Object.values(CONTACT_FIELD);
const focusResult = (node: HTMLDivElement | null) => node?.focus();

interface ContactResponse {
  ok?: boolean;
  error?: { code?: string; message?: string };
}

function ContactShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="contact-shell">
      <div className="contact-chrome">
        <WindowChrome />
        <span>{contactChrome.promptLabel}</span>
        <span className="contact-channel">{contactChrome.rightTag}</span>
      </div>
      <div className="contact-body">{children}</div>
    </div>
  );
}

export function ContactForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>(STATUS.IDLE);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [failureCount, setFailureCount] = useState(INITIAL_FAILURE_COUNT);
  const summaryRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const formId = useId();
  const counterId = `${formId}-count`;
  const fieldId = (field: ContactField) => `${formId}-${field}`;
  const invalidFields = CONTACT_FIELDS.filter((field) => errors[field]);
  const busy = status === STATUS.SUBMITTING;

  useEffect(() => {
    if (failureCount > INITIAL_FAILURE_COUNT) summaryRef.current?.focus();
  }, [failureCount]);

  function change(field: ContactField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      const valid = ContactSchema.shape[field].safeParse(value).success;
      setErrors((current) => ({ ...current, [field]: valid ? '' : contactContent.errors[field] }));
    }
    if (!pendingRef.current) {
      setStatus(STATUS.IDLE);
      setErrorMsg('');
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const field of CONTACT_FIELDS) {
      if (!ContactSchema.shape[field].safeParse(values[field]).success) {
        fieldErrors[field] = contactContent.errors[field];
      }
    }
    setErrors(fieldErrors);
    setErrorMsg('');
    if (Object.keys(fieldErrors).length) {
      setStatus(STATUS.ERROR);
      setFailureCount((count) => count + 1);
      return;
    }
    pendingRef.current = true;
    setStatus(STATUS.SUBMITTING);
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, field_company: honeypot }),
      });
      const data = (await res.json().catch(() => null)) as ContactResponse | null;
      const apiError = data?.error;
      if (res.status === QUEUED_STATUS && apiError?.code === CONTACT_DELIVERY_CODE.QUEUED) {
        setStatus(STATUS.QUEUED);
        return;
      }
      if (!res.ok || data?.ok !== true || res.status === QUEUED_STATUS) {
        throw new Error(
          typeof apiError?.message === 'string'
            ? apiError.message
            : contactContent.errors.requestFailed,
        );
      }
      setStatus(STATUS.SUCCESS);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : contactContent.errors.requestFailed);
      setStatus(STATUS.ERROR);
      setFailureCount((count) => count + 1);
    } finally {
      pendingRef.current = false;
    }
  }

  return (
    <ContactShell>
      <form
        onSubmit={submit}
        noValidate
        className="contact-form"
        aria-busy={busy}
        data-testid="contact-form"
      >
        {(invalidFields.length > 0 || errorMsg) && (
          <div ref={summaryRef} role="alert" tabIndex={-1} className="contact-alert">
            {invalidFields.length > 0 && (
              <>
                <p>{contactContent.form.errorSummary}</p>
                <ul>
                  {invalidFields.map((field) => (
                    <li key={field}>
                      <a
                        href={`#${fieldId(field)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          document.getElementById(fieldId(field))?.focus();
                        }}
                      >
                        {contactContent.form.fieldLabels[field]}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {errorMsg && (
              <p>
                {contactContent.form.errorPrefix} {errorMsg} {contactContent.form.retained}{' '}
                {contactContent.form.retryEmail}{' '}
                <a href={`mailto:${contactContent.section.email}`}>
                  {contactContent.section.email}
                </a>
              </p>
            )}
          </div>
        )}
        <input
          type="text"
          name="field_company"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          data-testid="contact-honeypot"
          className="contact-honeypot"
        />
        <Field
          id={fieldId(CONTACT_FIELD.NAME)}
          name={CONTACT_FIELD.NAME}
          label={contactContent.form.nameLabel}
          value={values.name}
          onChange={(event) => change(CONTACT_FIELD.NAME, event.target.value)}
          error={errors.name ?? ''}
          required
          minLength={CONTACT_LIMITS.nameMin}
          maxLength={CONTACT_LIMITS.nameMax}
          autoComplete="name"
          placeholder={contactContent.form.namePlaceholder}
        />
        <Field
          id={fieldId(CONTACT_FIELD.EMAIL)}
          name={CONTACT_FIELD.EMAIL}
          label={contactContent.form.emailLabel}
          type="email"
          value={values.email}
          onChange={(event) => change(CONTACT_FIELD.EMAIL, event.target.value)}
          error={errors.email ?? ''}
          required
          autoComplete="email"
          placeholder={contactContent.form.emailPlaceholder}
        />
        <Field
          id={fieldId(CONTACT_FIELD.MESSAGE)}
          name={CONTACT_FIELD.MESSAGE}
          label={contactContent.form.messageLabel}
          multiline
          value={values.message}
          onChange={(event) => change(CONTACT_FIELD.MESSAGE, event.target.value)}
          error={errors.message ?? ''}
          aria-describedby={counterId}
          required
          minLength={CONTACT_LIMITS.messageMin}
          maxLength={CONTACT_LIMITS.messageMax}
          rows={MESSAGE_ROWS}
          placeholder={contactContent.form.messagePlaceholder}
        />
        <p id={counterId} className="contact-count">
          {values.message.length}
          {contactContent.form.counterSeparator}
          {CONTACT_LIMITS.messageMax}
        </p>
        <div className="contact-submit-row" aria-live="polite">
          <button type="submit" aria-disabled={busy} aria-busy={busy} className="contact-send">
            {busy ? contactContent.form.submitting : contactContent.form.submit}
          </button>
          {status !== STATUS.SUCCESS && status !== STATUS.QUEUED && (
            <p className="contact-waiting">{contactContent.form.waiting}</p>
          )}
        </div>
        {status === STATUS.SUCCESS && (
          <div
            className="contact-success"
            role="status"
            data-testid="contact-success"
            tabIndex={-1}
            ref={focusResult}
          >
            <p>{contactContent.success.title}</p>
            <p>{contactContent.success.message}</p>
          </div>
        )}
        {status === STATUS.QUEUED && (
          <div
            className="contact-success"
            role="status"
            data-testid="contact-queued"
            tabIndex={-1}
            ref={focusResult}
          >
            <p>{contactContent.queued.title}</p>
            <p>
              {contactContent.queued.message}{' '}
              <a href={contactContent.queued.linkHref}>{contactContent.queued.linkLabel}</a>
            </p>
          </div>
        )}
      </form>
    </ContactShell>
  );
}
