import { usePathname } from 'next/navigation';
import { type FormEvent, useReducer, useRef } from 'react';
import type { ContactContent } from '@/content/contact';
import {
  CONTACT_DELIVERY_CODE,
  CONTACT_FIELD,
  type ContactField,
  contactErrorMessage,
  contactFieldError,
} from '@/content/contact-rules';
import { localeOfPath } from '@/content/site-locale';
import { HTTP_STATUS } from '@/lib/http-status';
import { postJson } from '@/lib/post-json';
import { addRef } from '@/lib/request-refs.client';
import { REQUEST_ID_HEADER, SITE_LOCALE_HEADER } from '@/lib/stream-protocol';
import { useMessageStore } from '../ContactIsland/ContactIslandProvider.client';
import { FIELD_CHECKS } from './contact-form-checks';
import {
  CONTACT_PHASE,
  type ContactFieldErrors,
  type ContactPhase,
  contactSubmitReducer,
  INITIAL_CONTACT_SUBMIT_STATE,
  visibleContactErrors,
} from './contact-submit-state';

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
const REQUEST_TIMEOUT_MS = 20_000;

interface ContactResponse {
  ok?: boolean;
  requestId?: string;
  error?: { code?: string; message?: string };
}

const STATUS_OF_PHASE: Record<ContactPhase, ContactStatus> = {
  [CONTACT_PHASE.IDLE]: CONTACT_STATUS.IDLE,
  [CONTACT_PHASE.SUBMITTING]: CONTACT_STATUS.SUBMITTING,
  [CONTACT_PHASE.INVALID]: CONTACT_STATUS.ERROR,
  [CONTACT_PHASE.FAILED]: CONTACT_STATUS.ERROR,
  [CONTACT_PHASE.QUEUED]: CONTACT_STATUS.QUEUED,
  [CONTACT_PHASE.SUCCESS]: CONTACT_STATUS.SUCCESS,
};

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
  const [state, dispatch] = useReducer(contactSubmitReducer, INITIAL_CONTACT_SUBMIT_STATE);
  const messageStore = useMessageStore();
  const pendingRef = useRef(false);
  const errors = visibleContactErrors(state.errors, FIELD_CHECKS.message(values.message));

  function noteEdit(field: ContactField, value: string) {
    const error = FIELD_CHECKS[field](value) ? undefined : contactFieldError(copy, field, value);
    dispatch({ type: 'edited', field, error });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const fieldErrors: ContactFieldErrors = {};
    for (const field of CONTACT_FIELDS) {
      if (!FIELD_CHECKS[field](values[field])) {
        fieldErrors[field] = contactFieldError(copy, field, values[field]);
      }
    }
    dispatch({ type: 'validated', errors: fieldErrors });
    if (Object.keys(fieldErrors).length) return;
    pendingRef.current = true;
    let failureRef = '';
    try {
      const { response: res, data } = await postJson<ContactResponse>(
        CONTACT_ENDPOINT,
        { ...values, field_company: honeypot },
        { headers: { [SITE_LOCALE_HEADER]: pageLocale }, timeoutMs: REQUEST_TIMEOUT_MS },
      );
      const apiError = data?.error;
      const ref =
        typeof data?.requestId === 'string' && data.requestId
          ? data.requestId
          : (res.headers.get(REQUEST_ID_HEADER) ?? '');
      if (res.status === HTTP_STATUS.accepted && apiError?.code === CONTACT_DELIVERY_CODE.QUEUED) {
        messageStore.reset();
        if (ref) addRef(ref);
        dispatch({ type: 'queued' });
        return;
      }
      if (!res.ok || data?.ok !== true || res.status === HTTP_STATUS.accepted) {
        failureRef = ref;
        throw new Error(CONTACT_ENDPOINT, { cause: apiError?.code });
      }
      messageStore.reset();
      if (ref) addRef(ref);
      dispatch({ type: 'delivered', receipt: ref ? { ref, at: new Date() } : null });
    } catch (error) {
      const code =
        error instanceof Error && typeof error.cause === 'string' ? error.cause : undefined;
      dispatch({ type: 'rejected', message: contactErrorMessage(copy, code), ref: failureRef });
    } finally {
      pendingRef.current = false;
    }
  }

  function dismiss() {
    dispatch({ type: 'dismissed' });
  }

  return {
    status: STATUS_OF_PHASE[state.phase],
    busy: state.phase === CONTACT_PHASE.SUBMITTING,
    errors,
    errorMsg: state.errorMsg,
    errorRef: state.errorRef,
    receipt: state.receipt,
    failureCount: state.failureCount,
    noteEdit,
    submit,
    dismiss,
  };
}
