'use client';

import { useState } from 'react';
import { contactChrome } from '@/content/terminal-chrome';
import { WindowChrome } from '@/design-system';
import { Field } from '@/design-system/components/Field';

type Status = 'idle' | 'submitting' | 'success' | 'error';

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
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, field_company: honeypot }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <ContactShell>
        <div className="contact-success" role="status" data-testid="contact-success">
          <p>EXECUTE_SEND :: SUCCESS</p>
          <p>handshake initiated · expect reply within 48h</p>
        </div>
      </ContactShell>
    );
  }

  return (
    <ContactShell>
      <form
        onSubmit={submit}
        className="contact-form flex flex-col gap-[14px]"
        aria-busy={status === 'submitting'}
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
          label="$ name:"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="[INPUT REQUIRED]"
        />
        <Field
          name="email"
          label="$ email:"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="[INPUT REQUIRED]"
        />
        <Field
          name="message"
          label="$ message:"
          multiline
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="[READY FOR DATA INPUT...]"
        />
        <div
          className="flex items-center gap-3 flex-wrap mt-1 max-md:flex-col max-md:items-stretch"
          aria-live="polite"
        >
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="contact-send self-start max-md:self-auto max-md:w-full bg-primary-500 text-black border border-primary-500 px-[18px] py-[10px] font-bold text-xs tracking-[0.08em] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? 'TRANSMITTING...' : 'EXECUTE_SEND'}
          </button>
          <p className="text-primary-400 text-xs opacity-85 m-0 md:text-xs">
            waiting for manual override... _
          </p>
        </div>
        {status === 'error' && (
          <p role="alert" className="text-senary-300 text-xs">
            error: {errorMsg}
          </p>
        )}
      </form>
    </ContactShell>
  );
}
