import { describe, expect, it } from 'vitest';
import {
  CONTACT_PHASE,
  type ContactPhase,
  type ContactSubmitAction,
  type ContactSubmitState,
  contactSubmitReducer,
  INITIAL_CONTACT_SUBMIT_STATE,
} from './contact-submit-state';

const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const RECEIPT = { ref: REF, at: new Date(0) };
const NAME_ERROR = 'name needs two letters';

function inPhase(phase: ContactPhase, extra: Partial<ContactSubmitState> = {}): ContactSubmitState {
  return { ...INITIAL_CONTACT_SUBMIT_STATE, phase, ...extra };
}

function run(state: ContactSubmitState, ...actions: ContactSubmitAction[]) {
  return actions.reduce(contactSubmitReducer, state);
}

describe('contactSubmitReducer', () => {
  it('starts idle with nothing to show', () => {
    expect(INITIAL_CONTACT_SUBMIT_STATE).toEqual({
      phase: CONTACT_PHASE.IDLE,
      errors: {},
      errorMsg: '',
      errorRef: '',
      receipt: null,
      failureCount: 0,
    });
  });

  describe('validated', () => {
    it('with field errors becomes invalid, keeps them and counts the failure', () => {
      const next = run(
        inPhase(CONTACT_PHASE.FAILED, { errorMsg: 'boom', errorRef: REF, failureCount: 1 }),
        { type: 'validated', errors: { name: NAME_ERROR } },
      );
      expect(next).toEqual(
        inPhase(CONTACT_PHASE.INVALID, { errors: { name: NAME_ERROR }, failureCount: 2 }),
      );
    });

    it('with no errors starts the send and clears the previous failure', () => {
      const next = run(
        inPhase(CONTACT_PHASE.FAILED, {
          errors: { name: NAME_ERROR },
          errorMsg: 'boom',
          errorRef: REF,
          failureCount: 1,
        }),
        { type: 'validated', errors: {} },
      );
      expect(next).toEqual(inPhase(CONTACT_PHASE.SUBMITTING, { failureCount: 1 }));
    });

    it('is refused while a send is in flight', () => {
      const sending = inPhase(CONTACT_PHASE.SUBMITTING);
      expect(run(sending, { type: 'validated', errors: {} })).toBe(sending);
      expect(run(sending, { type: 'validated', errors: { name: NAME_ERROR } })).toBe(sending);
    });
  });

  describe('settling a send', () => {
    const sending = inPhase(CONTACT_PHASE.SUBMITTING);

    it('delivered keeps the receipt', () => {
      expect(run(sending, { type: 'delivered', receipt: RECEIPT })).toEqual(
        inPhase(CONTACT_PHASE.SUCCESS, { receipt: RECEIPT }),
      );
    });

    it('delivered without a ref keeps no receipt', () => {
      expect(run(sending, { type: 'delivered', receipt: null })).toEqual(
        inPhase(CONTACT_PHASE.SUCCESS),
      );
    });

    it('queued saves the message for retry', () => {
      expect(run(sending, { type: 'queued' })).toEqual(inPhase(CONTACT_PHASE.QUEUED));
    });

    it('rejected carries the message and ref and counts the failure', () => {
      expect(run(sending, { type: 'rejected', message: 'rate limited', ref: REF })).toEqual(
        inPhase(CONTACT_PHASE.FAILED, { errorMsg: 'rate limited', errorRef: REF, failureCount: 1 }),
      );
    });

    const settling: ContactSubmitAction[] = [
      { type: 'delivered', receipt: RECEIPT },
      { type: 'queued' },
      { type: 'rejected', message: 'x', ref: REF },
    ];
    const notSending = [
      CONTACT_PHASE.IDLE,
      CONTACT_PHASE.INVALID,
      CONTACT_PHASE.FAILED,
      CONTACT_PHASE.QUEUED,
      CONTACT_PHASE.SUCCESS,
    ];
    it.each(
      notSending.flatMap((phase) =>
        settling.map((action) => [phase, action.type, action] as const),
      ),
    )('%s ignores %s when nothing is in flight', (phase, _type, action) => {
      const state = inPhase(phase);
      expect(run(state, action)).toBe(state);
    });
  });

  describe('edited', () => {
    it('drops the field error when the new value is valid and returns to idle', () => {
      const next = run(
        inPhase(CONTACT_PHASE.INVALID, { errors: { name: NAME_ERROR, email: 'bad' } }),
        { type: 'edited', field: 'name', error: undefined },
      );
      expect(next).toEqual(inPhase(CONTACT_PHASE.IDLE, { errors: { email: 'bad' } }));
    });

    it('replaces the field error text while the new value is still invalid', () => {
      const next = run(inPhase(CONTACT_PHASE.INVALID, { errors: { name: NAME_ERROR } }), {
        type: 'edited',
        field: 'name',
        error: 'name is too long',
      });
      expect(next.errors).toEqual({ name: 'name is too long' });
      expect(next.phase).toBe(CONTACT_PHASE.IDLE);
    });

    it('leaves a field without an error unmarked', () => {
      const next = run(inPhase(CONTACT_PHASE.INVALID, { errors: { email: 'bad' } }), {
        type: 'edited',
        field: 'name',
        error: 'name needs two letters',
      });
      expect(next.errors).toEqual({ email: 'bad' });
    });

    it('clears the request error but keeps its ref', () => {
      const next = run(
        inPhase(CONTACT_PHASE.FAILED, { errorMsg: 'boom', errorRef: REF, failureCount: 1 }),
        { type: 'edited', field: 'message', error: undefined },
      );
      expect(next).toEqual(inPhase(CONTACT_PHASE.IDLE, { errorRef: REF, failureCount: 1 }));
    });

    it.each([CONTACT_PHASE.SUBMITTING, CONTACT_PHASE.QUEUED, CONTACT_PHASE.SUCCESS])(
      'is ignored while %s',
      (phase) => {
        const state = inPhase(phase);
        expect(run(state, { type: 'edited', field: 'name', error: undefined })).toBe(state);
      },
    );
  });

  describe('dismissed', () => {
    it.each([CONTACT_PHASE.SUCCESS, CONTACT_PHASE.QUEUED])(
      'returns %s to a clean idle form and keeps the failure count',
      (phase) => {
        const next = run(inPhase(phase, { receipt: RECEIPT, errorRef: REF, failureCount: 3 }), {
          type: 'dismissed',
        });
        expect(next).toEqual(inPhase(CONTACT_PHASE.IDLE, { failureCount: 3 }));
      },
    );

    it('is refused while a send is in flight', () => {
      const sending = inPhase(CONTACT_PHASE.SUBMITTING);
      expect(run(sending, { type: 'dismissed' })).toBe(sending);
    });
  });
});
