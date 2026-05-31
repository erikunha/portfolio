'use client';

import { useState } from 'react';
import { Field } from '@/design-system/components/Field';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  // Honeypot: hidden off-screen input. A real user never sees or fills this,
  // so the value stays ''. Naive bots that submit every visible field will
  // set it — the server then silently returns a successful-looking 200.
  // See docs/audit/2026-05-19-principal-audit.md Theme 1.4.
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
      <div className="contact-success" role="status" data-testid="contact-success">
        <p>EXECUTE_SEND :: SUCCESS</p>
        <p>handshake initiated · expect reply within 48h</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-[14px]"
      aria-busy={status === 'submitting'}
      data-testid="contact-form"
    >
      {/* Honeypot field. Hidden off-screen with aria-hidden + tabindex=-1 so
          keyboard + screen-reader users skip it entirely. The inline style is
          deliberate (vs a class) to keep this single-purpose anti-spam input
          encapsulated and not reliant on any external CSS rule a future
          refactor could break. autoComplete=off + name=field_company match
          the server-side check in lib/contact-validation.ts. */}
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
          className="contact-send self-start max-md:self-auto max-md:w-full bg-signal text-black border border-signal px-[18px] py-[10px] font-bold text-xs tracking-[0.08em] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'TRANSMITTING...' : 'EXECUTE_SEND'}
        </button>
        <p className="text-text-muted text-[10px] opacity-85 m-0 md:text-xs">
          waiting for manual override... _
        </p>
      </div>
      {status === 'error' && (
        <p role="alert" className="text-error text-xs">
          error: {errorMsg}
        </p>
      )}
    </form>
  );
}
