'use client';

import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { ContactContent } from '@/content/contact';
import {
  CONTACT_DELIVERY_CODE,
  CONTACT_FIELD,
  CONTACT_LIMITS,
  type ContactField,
  contactErrorMessage,
  contactErrorSummary,
} from '@/content/contact-copy';
import type { TerminalChrome } from '@/content/schemas';
import { WindowChrome } from '@/design-system';
import { Field } from '@/design-system/components/Field';
import { messageStore } from './messageStore';

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
const FIELD_BORDER = '[&:not([aria-invalid=true])]:border-primary-500';
type TypedField = Exclude<ContactField, typeof CONTACT_FIELD.MESSAGE>;
const INITIAL_TYPED: Record<TypedField, string> = { name: '', email: '' };
const CONTACT_FIELDS = Object.values(CONTACT_FIELD);
const EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const FIELD_CHECKS: Record<ContactField, (value: string) => boolean> = {
  [CONTACT_FIELD.NAME]: (value) => {
    const length = value.trim().length;
    return length >= CONTACT_LIMITS.nameMin && length <= CONTACT_LIMITS.nameMax;
  },
  [CONTACT_FIELD.EMAIL]: (value) => EMAIL_PATTERN.test(value.trim()),
  [CONTACT_FIELD.MESSAGE]: (value) => {
    const length = value.trim().length;
    return length >= CONTACT_LIMITS.messageMin && length <= CONTACT_LIMITS.messageMax;
  },
};
const focusResult = (node: HTMLDivElement | null) => node?.focus();

interface ContactResponse {
  ok?: boolean;
  error?: { code?: string; message?: string };
}

function ContactShell({ chrome, children }: { chrome: TerminalChrome; children: React.ReactNode }) {
  return (
    <div className="contact-shell">
      <div className="contact-chrome">
        <WindowChrome />
        <span>{chrome.promptLabel}</span>
        <span className="contact-channel">{chrome.rightTag}</span>
      </div>
      <div className="contact-body">{children}</div>
    </div>
  );
}

export function ContactForm({ copy, chrome }: { copy: ContactContent; chrome: TerminalChrome }) {
  const [typed, setTyped] = useState(INITIAL_TYPED);
  const message = useSyncExternalStore(
    messageStore.subscribe,
    messageStore.getSnapshot,
    messageStore.getServerSnapshot,
  );
  const values: Record<ContactField, string> = { ...typed, message };
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>(STATUS.IDLE);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [failureCount, setFailureCount] = useState(INITIAL_FAILURE_COUNT);
  const summaryRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const formId = useId();
  const counterId = `${formId}-count`;
  const summaryId = `${formId}-summary`;
  const requestErrorId = `${formId}-request-error`;
  const fieldId = (field: ContactField) => `${formId}-${field}`;
  const invalidFields = CONTACT_FIELDS.filter((field) => errors[field]);
  const busy = status === STATUS.SUBMITTING;

  const messageFieldId = fieldId(CONTACT_FIELD.MESSAGE);
  const fieldShown = status !== STATUS.SUCCESS && status !== STATUS.QUEUED;
  useEffect(
    () => (fieldShown ? messageStore.bindField(messageFieldId) : undefined),
    [fieldShown, messageFieldId],
  );

  useEffect(() => {
    if (failureCount > INITIAL_FAILURE_COUNT) summaryRef.current?.focus();
  }, [failureCount]);

  useEffect(() => {
    setErrors((current) => {
      if (!current.message || !FIELD_CHECKS.message(message)) return current;
      const { message: _cleared, ...rest } = current;
      return rest;
    });
  }, [message]);

  function change(field: ContactField, value: string) {
    if (field === CONTACT_FIELD.MESSAGE) messageStore.set(value);
    else setTyped((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      const valid = FIELD_CHECKS[field](value);
      setErrors((current) => {
        const { [field]: _cleared, ...rest } = current;
        return valid ? rest : { ...current, [field]: copy.errors[field] };
      });
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
      if (!FIELD_CHECKS[field](values[field])) {
        fieldErrors[field] = copy.errors[field];
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
        messageStore.reset();
        setStatus(STATUS.QUEUED);
        return;
      }
      if (!res.ok || data?.ok !== true || res.status === QUEUED_STATUS) {
        throw new Error(CONTACT_ENDPOINT, { cause: apiError?.code });
      }
      messageStore.reset();
      setStatus(STATUS.SUCCESS);
    } catch (error) {
      const code =
        error instanceof Error && typeof error.cause === 'string' ? error.cause : undefined;
      setErrorMsg(contactErrorMessage(copy, code));
      setStatus(STATUS.ERROR);
      setFailureCount((count) => count + 1);
    } finally {
      pendingRef.current = false;
    }
  }

  if (status === STATUS.SUCCESS || status === STATUS.QUEUED) {
    return (
      <ContactShell chrome={chrome}>
        {status === STATUS.SUCCESS && (
          <div
            className="contact-success"
            role="status"
            data-testid="contact-success"
            tabIndex={-1}
            ref={focusResult}
          >
            <p>{copy.success.title}</p>
            <p>{copy.success.message}</p>
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
            <p>{copy.queued.title}</p>
            <p>
              {copy.queued.message} <a href={copy.queued.linkHref}>{copy.queued.linkLabel}</a>
            </p>
          </div>
        )}
      </ContactShell>
    );
  }

  return (
    <ContactShell chrome={chrome}>
      <form
        onSubmit={submit}
        noValidate
        className="contact-form"
        aria-busy={busy}
        data-testid="contact-form"
      >
        {(invalidFields.length > 0 || errorMsg) && (
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            className="contact-alert"
            aria-labelledby={invalidFields.length > 0 ? summaryId : requestErrorId}
          >
            {invalidFields.length > 0 && (
              <p>
                <span id={summaryId}>{contactErrorSummary(copy, invalidFields.length)}</span>
                {invalidFields.map((field, index) => (
                  <Fragment key={field}>
                    {index === 0 ? ' ' : copy.form.errorSummary.separator}
                    <a
                      className="contact-summary-link"
                      href={`#${fieldId(field)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(fieldId(field))?.focus();
                      }}
                    >
                      {copy.form.fieldLabels[field]}
                    </a>
                  </Fragment>
                ))}
              </p>
            )}
            {errorMsg && (
              <p id={requestErrorId}>
                {copy.form.errorPrefix} {errorMsg}. {copy.form.retained} {copy.form.retryEmail}{' '}
                <a href={`mailto:${copy.section.email}`}>{copy.section.email}</a>
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
          className={FIELD_BORDER}
          id={fieldId(CONTACT_FIELD.NAME)}
          name={CONTACT_FIELD.NAME}
          label={copy.form.nameLabel}
          value={values.name}
          onChange={(event) => change(CONTACT_FIELD.NAME, event.target.value)}
          error={errors.name ?? ''}
          required
          minLength={CONTACT_LIMITS.nameMin}
          maxLength={CONTACT_LIMITS.nameMax}
          autoComplete="name"
          placeholder={copy.form.namePlaceholder}
        />
        <Field
          className={FIELD_BORDER}
          id={fieldId(CONTACT_FIELD.EMAIL)}
          name={CONTACT_FIELD.EMAIL}
          label={copy.form.emailLabel}
          type="email"
          value={values.email}
          onChange={(event) => change(CONTACT_FIELD.EMAIL, event.target.value)}
          error={errors.email ?? ''}
          required
          autoComplete="email"
          placeholder={copy.form.emailPlaceholder}
        />
        <Field
          className={FIELD_BORDER}
          id={messageFieldId}
          name={CONTACT_FIELD.MESSAGE}
          label={copy.form.messageLabel}
          multiline
          value={values.message}
          onChange={(event) => change(CONTACT_FIELD.MESSAGE, event.target.value)}
          error={errors.message ?? ''}
          aria-describedby={counterId}
          required
          minLength={CONTACT_LIMITS.messageMin}
          maxLength={CONTACT_LIMITS.messageMax}
          rows={MESSAGE_ROWS}
          placeholder={copy.form.messagePlaceholder}
        />
        <p id={counterId} className="contact-count">
          {values.message.trim().length}
          {copy.form.counterSeparator}
          {CONTACT_LIMITS.messageMax}
        </p>
        <div className="contact-submit-row" aria-live="polite">
          <button type="submit" aria-disabled={busy} aria-busy={busy} className="contact-send">
            {busy ? copy.form.submitting : copy.form.submit}
          </button>
          <p className="contact-waiting">{copy.form.waiting}</p>
        </div>
        <p className="contact-privacy">{copy.form.privacy}</p>
      </form>
    </ContactShell>
  );
}
