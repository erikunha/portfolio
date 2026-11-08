import { usePathname } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ContactContent } from '@/content/contact';
import {
  CONTACT_DELIVERY_CODE,
  CONTACT_FIELD,
  type ContactField,
  contactErrorMessage,
  contactFieldError,
} from '@/content/contact-rules';
import { localeOfPath } from '@/content/site-locale';
import { postJson } from '@/lib/post-json';
import { addRef } from '@/lib/request-refs.client';
import { ASK_LOCALE_HEADER } from '@/lib/stream-protocol';
import { FIELD_CHECKS } from './contact-form-checks';
import { messageStore } from './messageStore';

export const CONTACT_STATUS = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  QUEUED: 'queued',
  ERROR: 'error',
} as const;
export type ContactStatus = (typeof CONTACT_STATUS)[keyof typeof CONTACT_STATUS];

export const CONTACT_FIELDS = Object.values(CONTACT_FIELD);

const CONTACT_ENDPOINT = '/api/contact';
const QUEUED_STATUS = 202;
const REQUEST_ID_HEADER = 'X-Request-Id';
const REQUEST_TIMEOUT_MS = 20_000;
const INITIAL_FAILURE_COUNT = 0;

type FieldErrors = Partial<Record<ContactField, string>>;

interface ContactResponse {
  ok?: boolean;
  requestId?: string;
  error?: { code?: string; message?: string };
}

export function useContactSubmit({
  copy,
  values,
  honeypot,
}: {
  copy: ContactContent;
  values: Record<ContactField, string>;
  honeypot: string;
}) {
  const pageLocale = localeOfPath(usePathname());
  const [status, setStatus] = useState<ContactStatus>(CONTACT_STATUS.IDLE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<{ ref: string; at: Date } | null>(null);
  const [queuedRef, setQueuedRef] = useState('');
  const [errorRef, setErrorRef] = useState('');
  const [failureCount, setFailureCount] = useState(INITIAL_FAILURE_COUNT);
  const pendingRef = useRef(false);
  const { message } = values;

  useEffect(() => {
    setErrors((current) => {
      if (!current.message || !FIELD_CHECKS.message(message)) return current;
      const { message: _cleared, ...rest } = current;
      return rest;
    });
  }, [message]);

  function noteEdit(field: ContactField, value: string) {
    if (errors[field]) {
      const valid = FIELD_CHECKS[field](value);
      setErrors((current) => {
        const { [field]: _cleared, ...rest } = current;
        return valid ? rest : { ...current, [field]: contactFieldError(copy, field, value) };
      });
    }
    if (!pendingRef.current) {
      setStatus(CONTACT_STATUS.IDLE);
      setErrorMsg('');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const fieldErrors: FieldErrors = {};
    for (const field of CONTACT_FIELDS) {
      if (!FIELD_CHECKS[field](values[field])) {
        fieldErrors[field] = contactFieldError(copy, field, values[field]);
      }
    }
    setErrors(fieldErrors);
    setErrorMsg('');
    setErrorRef('');
    if (Object.keys(fieldErrors).length) {
      setStatus(CONTACT_STATUS.ERROR);
      setFailureCount((count) => count + 1);
      return;
    }
    pendingRef.current = true;
    setStatus(CONTACT_STATUS.SUBMITTING);
    try {
      const { response: res, data } = await postJson<ContactResponse>(
        CONTACT_ENDPOINT,
        { ...values, field_company: honeypot },
        { headers: { [ASK_LOCALE_HEADER]: pageLocale }, timeoutMs: REQUEST_TIMEOUT_MS },
      );
      const apiError = data?.error;
      const ref =
        typeof data?.requestId === 'string' && data.requestId
          ? data.requestId
          : (res.headers.get(REQUEST_ID_HEADER) ?? '');
      if (res.status === QUEUED_STATUS && apiError?.code === CONTACT_DELIVERY_CODE.QUEUED) {
        messageStore.reset();
        if (ref) addRef(ref);
        setQueuedRef(ref);
        setStatus(CONTACT_STATUS.QUEUED);
        return;
      }
      if (!res.ok || data?.ok !== true || res.status === QUEUED_STATUS) {
        setErrorRef(ref);
        throw new Error(CONTACT_ENDPOINT, { cause: apiError?.code });
      }
      messageStore.reset();
      if (ref) addRef(ref);
      setReceipt(ref ? { ref, at: new Date() } : null);
      setStatus(CONTACT_STATUS.SUCCESS);
    } catch (error) {
      const code =
        error instanceof Error && typeof error.cause === 'string' ? error.cause : undefined;
      setErrorMsg(contactErrorMessage(copy, code));
      setStatus(CONTACT_STATUS.ERROR);
      setFailureCount((count) => count + 1);
    } finally {
      pendingRef.current = false;
    }
  }

  return {
    status,
    busy: status === CONTACT_STATUS.SUBMITTING,
    errors,
    errorMsg,
    errorRef,
    receipt,
    queuedRef,
    failureCount,
    noteEdit,
    submit,
  };
}
