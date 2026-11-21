import type { ContactField } from '@/content/contact-rules';

export const CONTACT_PHASE = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  INVALID: 'invalid',
  FAILED: 'failed',
  QUEUED: 'queued',
  SUCCESS: 'success',
} as const;
export type ContactPhase = (typeof CONTACT_PHASE)[keyof typeof CONTACT_PHASE];

export type ContactFieldErrors = Partial<Record<ContactField, string>>;
export type ContactReceipt = { ref: string; at: Date };

export interface ContactSubmitState {
  phase: ContactPhase;
  errors: ContactFieldErrors;
  errorMsg: string;
  errorRef: string;
  receipt: ContactReceipt | null;
  failureCount: number;
}

export type ContactSubmitAction =
  | { type: 'validated'; errors: ContactFieldErrors }
  | { type: 'delivered'; receipt: ContactReceipt | null }
  | { type: 'queued' }
  | { type: 'rejected'; message: string; ref: string }
  | { type: 'edited'; field: ContactField; error: string | undefined }
  | { type: 'dismissed' };

export const INITIAL_CONTACT_SUBMIT_STATE: ContactSubmitState = {
  phase: CONTACT_PHASE.IDLE,
  errors: {},
  errorMsg: '',
  errorRef: '',
  receipt: null,
  failureCount: 0,
};

const FAILURE_STEP = 1;

function validated(state: ContactSubmitState, errors: ContactFieldErrors): ContactSubmitState {
  if (state.phase === CONTACT_PHASE.SUBMITTING) return state;
  const cleared = { ...state, errors, errorMsg: '', errorRef: '' };
  if (Object.keys(errors).length === 0) return { ...cleared, phase: CONTACT_PHASE.SUBMITTING };
  return {
    ...cleared,
    phase: CONTACT_PHASE.INVALID,
    failureCount: state.failureCount + FAILURE_STEP,
  };
}

function editedErrors(
  errors: ContactFieldErrors,
  field: ContactField,
  error: string | undefined,
): ContactFieldErrors {
  if (errors[field] === undefined) return errors;
  const { [field]: _marked, ...others } = errors;
  return error === undefined ? others : { ...others, [field]: error };
}

function edited(
  state: ContactSubmitState,
  field: ContactField,
  error: string | undefined,
): ContactSubmitState {
  const editable =
    state.phase === CONTACT_PHASE.IDLE ||
    state.phase === CONTACT_PHASE.INVALID ||
    state.phase === CONTACT_PHASE.FAILED;
  if (!editable) return state;
  return {
    ...state,
    phase: CONTACT_PHASE.IDLE,
    errors: editedErrors(state.errors, field, error),
    errorMsg: '',
  };
}

export function contactSubmitReducer(
  state: ContactSubmitState,
  action: ContactSubmitAction,
): ContactSubmitState {
  if (action.type === 'validated') return validated(state, action.errors);
  if (action.type === 'edited') return edited(state, action.field, action.error);
  if (action.type === 'dismissed') {
    if (state.phase === CONTACT_PHASE.SUBMITTING) return state;
    return { ...INITIAL_CONTACT_SUBMIT_STATE, failureCount: state.failureCount };
  }
  if (state.phase !== CONTACT_PHASE.SUBMITTING) return state;
  if (action.type === 'delivered') {
    return { ...state, phase: CONTACT_PHASE.SUCCESS, receipt: action.receipt };
  }
  if (action.type === 'queued') return { ...state, phase: CONTACT_PHASE.QUEUED };
  return {
    ...state,
    phase: CONTACT_PHASE.FAILED,
    errorMsg: action.message,
    errorRef: action.ref,
    failureCount: state.failureCount + FAILURE_STEP,
  };
}

export function visibleContactErrors(
  errors: ContactFieldErrors,
  messageIsValid: boolean,
): ContactFieldErrors {
  if (!errors.message || !messageIsValid) return errors;
  const { message: _settled, ...rest } = errors;
  return rest;
}
