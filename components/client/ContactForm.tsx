'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
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
        body: JSON.stringify({ name, email, message }),
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
      <div className="contact contact--success">
        <p>EXECUTE_SEND :: SUCCESS</p>
        <p>handshake initiated · expect reply within 48h</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="contact">
      <label className="contact__field">
        <span className="contact__prompt">
          <span className="contact__prompt-user">user@terminal:~$</span>{' '}
          <span className="contact__prompt-cmd">enter_name</span>
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="[INPUT REQUIRED]"
          className="contact__input"
        />
      </label>
      <label className="contact__field">
        <span className="contact__prompt">
          <span className="contact__prompt-user">user@terminal:~$</span>{' '}
          <span className="contact__prompt-cmd">enter_email</span>
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="[INPUT REQUIRED]"
          className="contact__input"
        />
      </label>
      <label className="contact__field">
        <span className="contact__prompt">
          <span className="contact__prompt-user">user@terminal:~$</span>{' '}
          <span className="contact__prompt-cmd">enter_message</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="[READY FOR DATA INPUT...]"
          className="contact__input contact__input--area"
        />
      </label>
      <div className="contact__submitrow">
        <button type="submit" disabled={status === 'submitting'} className="contact__send">
          {status === 'submitting' ? 'TRANSMITTING...' : 'EXECUTE_SEND'}
        </button>
        <p className="contact__cursor">waiting for manual override... _</p>
      </div>
      {status === 'error' && (
        <p role="alert" className="contact__error">
          error: {errorMsg}
        </p>
      )}
    </form>
  );
}
