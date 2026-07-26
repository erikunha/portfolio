import { describe, expect, it } from 'vitest';
import {
  type ConvergeState,
  type ConvergeThread,
  MIN_COMMENTS_PER_RESOLVED_THREAD,
  nextStep,
} from '@/scripts/review-converge';

const HEAD = '0ae2f0d7f85d0c8e4d1c574b913958ac6c66d3ba';

function thread(over: Partial<ConvergeThread> = {}): ConvergeThread {
  return { id: 'T1', path: 'lib/a.ts', isResolved: true, commentCount: 2, ...over };
}

function state(over: Partial<ConvergeState> = {}): ConvergeState {
  return {
    prNumber: 228,
    headSha: HEAD,
    latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict: Approve.**`,
    threads: [thread()],
    ...over,
  };
}

describe('review-converge nextStep', () => {
  it('converges on an approve for HEAD with every thread replied and resolved', () => {
    const step = nextStep(state());
    expect(step.done).toBe(true);
    expect(step.action).toBe('converged');
  });

  it('demands replies before anything else when a thread is unresolved', () => {
    const step = nextStep(
      state({
        threads: [thread({ id: 'A', isResolved: false }), thread({ id: 'B' })],
        // an approve is already on record; the unresolved thread must still win
      }),
    );
    expect(step.done).toBe(false);
    expect(step.action).toBe('reply-then-resolve');
    expect(step.threadIds).toEqual(['A']);
  });

  it('catches a silent resolve: resolved but carrying only the original comment', () => {
    const step = nextStep({
      ...state(),
      threads: [thread({ id: 'S', commentCount: 1 })],
    });
    expect(step.done).toBe(false);
    expect(step.action).toBe('add-missing-reply');
    expect(step.threadIds).toEqual(['S']);
  });

  it(`treats ${MIN_COMMENTS_PER_RESOLVED_THREAD} comments as the minimum evidence of a reply`, () => {
    const below = nextStep({
      ...state(),
      threads: [thread({ commentCount: MIN_COMMENTS_PER_RESOLVED_THREAD - 1 })],
    });
    const at = nextStep({
      ...state(),
      threads: [thread({ commentCount: MIN_COMMENTS_PER_RESOLVED_THREAD })],
    });
    expect(below.action).toBe('add-missing-reply');
    expect(at.done).toBe(true);
  });

  it('requests a review when claude[bot] has posted no parsable verdict', () => {
    const step = nextStep(state({ latestVerdictBody: null }));
    expect(step.action).toBe('request-review');
    expect(step.reason).toMatch(/No parsable verdict/);
  });

  it('requests a review when the verdict renders correctly but parses as none', () => {
    const step = nextStep(
      state({ latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict:** Approve` }),
    );
    expect(step.done).toBe(false);
    expect(step.action).toBe('request-review');
  });

  it('requests a review when the latest verdict is request-changes', () => {
    const step = nextStep(
      state({
        latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict: Request changes.**`,
      }),
    );
    expect(step.action).toBe('request-review');
    expect(step.reason).toMatch(/request-changes/);
  });

  it('refuses a stale approve that reviewed an older SHA', () => {
    const step = nextStep(
      state({
        latestVerdictBody: '**Verdict: Approve.** Reviewed at head commit `deadbeefdeadbeef`.',
      }),
    );
    expect(step.done).toBe(false);
    expect(step.action).toBe('request-review');
    expect(step.reason).toMatch(/stale/);
  });

  it('refuses an approve that states no head SHA at all', () => {
    const step = nextStep(state({ latestVerdictBody: '**Verdict: Approve.**' }));
    expect(step.done).toBe(false);
    expect(step.reason).toMatch(/no SHA stated/);
  });

  it('accepts an abbreviated reviewed SHA that prefixes HEAD', () => {
    const step = nextStep(
      state({ latestVerdictBody: '**Verdict: Approve.** Reviewed at head commit `0ae2f0d7f85d`.' }),
    );
    expect(step.done).toBe(true);
  });

  it('converges on a PR that drew no review threads at all', () => {
    const step = nextStep(state({ threads: [] }));
    expect(step.done).toBe(true);
  });
});
