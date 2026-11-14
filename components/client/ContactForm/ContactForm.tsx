'use client';

import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { BREAK_AFTER, BreakAfter } from '@/components/BreakAfter';
import type { ContactContent } from '@/content/contact';
import {
  CONTACT_FIELD,
  CONTACT_LIMITS,
  type ContactField,
  contactErrorSummary,
} from '@/content/contact-rules';
import type { TerminalChrome } from '@/content/schemas';
import { Field } from '@/design-system/components/Field';
import { longestCopy } from '@/lib/longest-copy';
import { ContactResult } from './ContactResult';
import { ContactShell } from './ContactShell';
import { errorMailto } from './contact-form-checks';
import { messageStore } from './messageStore';
import { CONTACT_FIELDS, CONTACT_STATUS, useContactSubmit } from './useContactSubmit';

const MESSAGE_ROWS = 5;
const INITIAL_FAILURE_COUNT = 0;
const INITIAL_DISMISS_COUNT = 0;
type TypedField = Exclude<ContactField, typeof CONTACT_FIELD.MESSAGE>;
const INITIAL_TYPED: Record<TypedField, string> = { name: '', email: '' };

export function ContactForm({ copy, chrome }: { copy: ContactContent; chrome: TerminalChrome }) {
  const [typed, setTyped] = useState(INITIAL_TYPED);
  const message = useSyncExternalStore(
    messageStore.subscribe,
    messageStore.getSnapshot,
    messageStore.getServerSnapshot,
  );
  const values: Record<ContactField, string> = { ...typed, message };
  const [honeypot, setHoneypot] = useState('');
  const [dismissCount, setDismissCount] = useState(INITIAL_DISMISS_COUNT);
  const {
    status,
    busy,
    errors,
    errorMsg,
    errorRef,
    receipt,
    failureCount,
    noteEdit,
    submit,
    dismiss,
  } = useContactSubmit({ copy, values, honeypot });
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const formId = useId();
  const counterId = `${formId}-count`;
  const summaryId = `${formId}-summary`;
  const requestErrorId = `${formId}-request-error`;
  const fieldId = (field: ContactField) => `${formId}-${field}`;
  const invalidFields = CONTACT_FIELDS.filter((field) => errors[field]);
  const failedLine = errorMsg ? copy.form.statusFailed : copy.form.statusInvalid;
  const settledLine = status === CONTACT_STATUS.ERROR ? failedLine : copy.form.waiting;
  const statusLine = busy ? copy.form.sending : settledLine;

  const messageFieldId = fieldId(CONTACT_FIELD.MESSAGE);
  const fieldShown = status !== CONTACT_STATUS.SUCCESS && status !== CONTACT_STATUS.QUEUED;
  useEffect(
    () => (fieldShown ? messageStore.bindField(messageFieldId) : undefined),
    [fieldShown, messageFieldId],
  );

  useLayoutEffect(() => {
    const fields = formRef.current?.elements;
    const typedInDom = (field: ContactField) =>
      (fields?.namedItem(field) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
    setTyped((current) => ({
      name: typedInDom(CONTACT_FIELD.NAME) || current.name,
      email: typedInDom(CONTACT_FIELD.EMAIL) || current.email,
    }));
    messageStore.seed(typedInDom(CONTACT_FIELD.MESSAGE));
  }, []);

  useEffect(() => {
    if (failureCount > INITIAL_FAILURE_COUNT) summaryRef.current?.focus();
  }, [failureCount]);

  useEffect(() => {
    if (dismissCount === INITIAL_DISMISS_COUNT) return;
    document.getElementById(messageFieldId)?.focus();
  }, [dismissCount, messageFieldId]);

  function dismissResult() {
    dismiss();
    setDismissCount((count) => count + 1);
  }

  function change(field: ContactField, value: string) {
    if (field === CONTACT_FIELD.MESSAGE) messageStore.set(value);
    else setTyped((current) => ({ ...current, [field]: value }));
    noteEdit(field, value);
  }

  if (status === CONTACT_STATUS.SUCCESS || status === CONTACT_STATUS.QUEUED) {
    return (
      <ContactShell chrome={chrome}>
        <ContactResult copy={copy} status={status} receipt={receipt} onDismiss={dismissResult} />
      </ContactShell>
    );
  }

  return (
    <ContactShell chrome={chrome}>
      <form
        ref={formRef}
        method="dialog"
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
                <span id={summaryId} className="contact-summary-lead">
                  {contactErrorSummary(copy, invalidFields.length)}
                </span>
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
            {errorMsg ? (
              <p id={requestErrorId}>
                {copy.form.errorPrefix} {errorMsg}. {copy.form.retained} {copy.form.retryEmail}{' '}
                <a href={errorMailto(copy, errorRef, values.message.trim())}>
                  <BreakAfter chars={BREAK_AFTER.email}>{copy.section.email}</BreakAfter>
                </a>
              </p>
            ) : null}
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
        <p className="contact-required">{copy.form.requiredNote}</p>
        <Field
          id={fieldId(CONTACT_FIELD.NAME)}
          name={CONTACT_FIELD.NAME}
          label={copy.form.nameLabel}
          value={values.name}
          onChange={(event) => change(CONTACT_FIELD.NAME, event.target.value)}
          error={errors.name ?? ''}
          readOnly={busy}
          required
          minLength={CONTACT_LIMITS.nameMin}
          maxLength={CONTACT_LIMITS.nameMax}
          autoComplete="name"
          placeholder={copy.form.namePlaceholder}
        />
        <Field
          id={fieldId(CONTACT_FIELD.EMAIL)}
          name={CONTACT_FIELD.EMAIL}
          label={copy.form.emailLabel}
          type="email"
          value={values.email}
          onChange={(event) => change(CONTACT_FIELD.EMAIL, event.target.value)}
          error={errors.email ?? ''}
          readOnly={busy}
          required
          autoComplete="email"
          placeholder={copy.form.emailPlaceholder}
        />
        <Field
          id={messageFieldId}
          name={CONTACT_FIELD.MESSAGE}
          label={copy.form.messageLabel}
          multiline
          value={values.message}
          onChange={(event) => change(CONTACT_FIELD.MESSAGE, event.target.value)}
          error={errors.message ?? ''}
          aria-describedby={counterId}
          readOnly={busy}
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
        <div className="contact-submit-row">
          <button
            type="submit"
            aria-disabled={busy}
            aria-busy={busy}
            className="contact-send"
            data-reserve={longestCopy([copy.form.submit, copy.form.submitting])}
          >
            <span>{busy ? copy.form.submitting : copy.form.submit}</span>
          </button>
          <p
            className="contact-waiting"
            role="status"
            data-testid="contact-status"
            data-reserve={longestCopy([
              copy.form.waiting,
              copy.form.sending,
              copy.form.statusInvalid,
              copy.form.statusFailed,
            ])}
          >
            <span>{statusLine}</span>
          </p>
        </div>
        <p className="contact-privacy">{copy.form.privacy}</p>
      </form>
    </ContactShell>
  );
}
