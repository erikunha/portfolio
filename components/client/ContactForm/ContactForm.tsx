'use client';

import { useState } from 'react';

const focusResult = (node: HTMLDivElement | null) => node?.focus();

import { CONTACT_DELIVERY_CODE, contactContent } from '@/content/contact';
import { contactChrome } from '@/content/terminal-chrome';
import { WindowChrome } from '@/design-system';
import { Field } from '@/design-system/components/Field';

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
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2_000;
const MESSAGE_ROWS = 5;

interface ContactResponse {
  ok?: boolean;
  error?: string | { code?: string; message?: string };
}

function ContactShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="contact-shell bg-[var(--color-secondary-900)] font-mono -m-[14px] min-[769px]:-m-[18px]">
      <div className="flex items-center gap-[10px] px-[14px] py-2 border-b border-[var(--color-primary-subtle)] text-primary-400 text-xs tracking-[0.14em]">
        <WindowChrome size={10} />
        <span className="max-md:hidden">{contactChrome.promptLabel}</span>
        <span className="ml-auto max-md:text-[10px]">{contactChrome.rightTag}</span>
      </div>
      <div className="px-4 py-[14px]">{children}</div>
    </div>
  );
}

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>(STATUS.IDLE);
  const [errorMsg, setErrorMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(STATUS.SUBMITTING);
    setErrorMsg('');
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, field_company: honeypot }),
      });
      const data = (await res.json().catch(() => null)) as ContactResponse | null;
      const apiError = data?.error;
      if (
        res.status === QUEUED_STATUS &&
        typeof apiError === 'object' &&
        apiError?.code === CONTACT_DELIVERY_CODE.QUEUED
      ) {
        setStatus(STATUS.QUEUED);
        return;
      }
      if (!res.ok || data?.ok === false || res.status === QUEUED_STATUS) {
        const serverMessage = typeof apiError === 'string' ? apiError : apiError?.message;
        throw new Error(
          typeof serverMessage === 'string' ? serverMessage : contactContent.errors.requestFailed,
        );
      }
      setStatus(STATUS.SUCCESS);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus(STATUS.ERROR);
    }
  }

  if (status === STATUS.SUCCESS) {
    return (
      <ContactShell>
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
      </ContactShell>
    );
  }

  if (status === STATUS.QUEUED) {
    return (
      <ContactShell>
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
      </ContactShell>
    );
  }

  return (
    <ContactShell>
      <form
        onSubmit={submit}
        className="contact-form flex flex-col gap-[14px]"
        aria-busy={status === STATUS.SUBMITTING}
        data-testid="contact-form"
      >
        <input
          type="text"
          name="field_company"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          data-testid="contact-honeypot"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
        <Field
          name="name"
          label={contactContent.form.nameLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={NAME_MIN_LENGTH}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="name"
          placeholder={contactContent.form.requiredPlaceholder}
        />
        <Field
          name="email"
          label={contactContent.form.emailLabel}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder={contactContent.form.requiredPlaceholder}
        />
        <Field
          name="message"
          label={contactContent.form.messageLabel}
          multiline
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={MESSAGE_MIN_LENGTH}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={MESSAGE_ROWS}
          placeholder={contactContent.form.messagePlaceholder}
        />
        <div
          className="flex items-center gap-3 flex-wrap mt-1 max-md:flex-col max-md:items-stretch"
          aria-live="polite"
        >
          <button
            type="submit"
            disabled={status === STATUS.SUBMITTING}
            className="contact-send self-start max-md:self-auto max-md:w-full bg-primary-500 text-black border border-primary-500 px-[18px] py-[10px] font-bold text-xs tracking-[0.08em] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === STATUS.SUBMITTING
              ? contactContent.form.submitting
              : contactContent.form.submit}
          </button>
          <p className="text-primary-400 text-xs opacity-85 m-0 md:text-xs">
            {contactContent.form.waiting}
          </p>
        </div>
        {status === STATUS.ERROR && (
          <p role="alert" className="text-senary-300 text-xs">
            {contactContent.form.errorPrefix} {errorMsg}
          </p>
        )}
      </form>
    </ContactShell>
  );
}
