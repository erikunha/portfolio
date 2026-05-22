'use client';

import { useState } from 'react';
import styles from './ContactForm.module.css';

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
      setErrorMsg((err as Error).message);
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className={styles.success} role="status" data-testid="contact-success">
        <p>EXECUTE_SEND :: SUCCESS</p>
        <p>handshake initiated · expect reply within 48h</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={styles.root}
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
      <label className={styles.field}>
        <span className={styles.prompt}>
          <span className={styles.promptUser}>user@terminal:~$</span>{' '}
          <span className={styles.promptCmd}>enter_name</span>
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="[INPUT REQUIRED]"
          className={styles.input}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.prompt}>
          <span className={styles.promptUser}>user@terminal:~$</span>{' '}
          <span className={styles.promptCmd}>enter_email</span>
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="[INPUT REQUIRED]"
          className={styles.input}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.prompt}>
          <span className={styles.promptUser}>user@terminal:~$</span>{' '}
          <span className={styles.promptCmd}>enter_message</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="[READY FOR DATA INPUT...]"
          className={`${styles.input} ${styles.inputArea}`}
        />
      </label>
      <div className={styles.submitrow} aria-live="polite">
        <button type="submit" disabled={status === 'submitting'} className={styles.send}>
          {status === 'submitting' ? 'TRANSMITTING...' : 'EXECUTE_SEND'}
        </button>
        <p className={styles.cursor}>waiting for manual override... _</p>
      </div>
      {status === 'error' && (
        <p role="alert" className={styles.error}>
          error: {errorMsg}
        </p>
      )}
    </form>
  );
}
