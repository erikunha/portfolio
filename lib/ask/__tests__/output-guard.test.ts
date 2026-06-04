// lib/ask/__tests__/output-guard.test.ts
// WS2: two-layer egress guard for /api/ask.
//
// Layer 1 (createStreamGuard): a stateful, allocation-bounded sliding-window
// scanner that inspects each stream chunk BEFORE it is enqueued and aborts on a
// system-prompt-leak marker or a length-cap breach — including a marker split
// across chunk boundaries — without buffering the whole stream.
//
// Layer 2 (validateAnswer): a plain post-hoc scan over the full buffered answer,
// the defense-in-depth audit record + regression signal.
//
// All assertions are behavioral: feed inputs, assert verdicts. The guard must
// never throw on legitimate input and must fail OPEN on its own internal error.

import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import {
  createStreamGuard,
  LEAK_MARKERS,
  MAX_ANSWER_CHARS,
  validateAnswer,
} from '@/lib/ask/output-guard';

// Feed an array of chunks through a fresh guard; return the per-chunk verdicts.
function inspectAll(chunks: string[]) {
  const guard = createStreamGuard();
  return chunks.map((c) => guard.inspect(c));
}

describe('LEAK_MARKERS — marker set', () => {
  it('is a non-empty readonly list of distinctive prompt fragments', () => {
    expect(Array.isArray(LEAK_MARKERS)).toBe(true);
    expect(LEAK_MARKERS.length).toBeGreaterThan(0);
    for (const m of LEAK_MARKERS) {
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThan(0);
    }
  });
});

describe('Layer 1: createStreamGuard — clean stream pass-through', () => {
  it('passes a normal answer chunked arbitrarily, returning ok every time', () => {
    const answer = 'Erik works at Betsson Group as a Senior Frontend Software Engineer.';
    const chunks = answer.match(/.{1,7}/gs) ?? [answer];
    const verdicts = inspectAll(chunks);
    expect(verdicts.every((v) => v.ok)).toBe(true);
  });

  it('does not mutate or consume the chunks it inspects (inspect-only)', () => {
    // The route enqueues the ORIGINAL chunk; the guard only returns a verdict.
    // Concatenating the fed chunks must equal the original input byte-for-byte.
    const answer = 'A normal answer about Erik, streamed in pieces.';
    const chunks = answer.match(/.{1,5}/gs) ?? [answer];
    const guard = createStreamGuard();
    let rebuilt = '';
    for (const c of chunks) {
      guard.inspect(c);
      rebuilt += c;
    }
    expect(rebuilt).toBe(answer);
  });

  it('passes every factual/edge corpus expect string clean (zero false positives)', () => {
    // Regression guard: the markers must never appear in a legitimate answer.
    // The corpus `expect` strings paraphrase correct answers about Erik.
    const goodAnswers = ASK_EVAL_CORPUS.filter((i) => i.kind !== 'jailbreak').map((i) => i.expect);
    for (const answer of goodAnswers) {
      // Chunk into small random-ish pieces to exercise the seam path too.
      const chunks = answer.match(/.{1,9}/gs) ?? [answer];
      const verdicts = inspectAll(chunks);
      const firstFail = verdicts.find((v) => !v.ok);
      expect(firstFail, `false positive on corpus answer: "${answer}"`).toBeUndefined();
    }
  });
});

describe('Layer 1: createStreamGuard — leak detection', () => {
  it('catches a marker delivered whole in one chunk', () => {
    const marker = LEAK_MARKERS[0] ?? '';
    const guard = createStreamGuard();
    const verdict = guard.inspect(`leaked content: ${marker} trailing`);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('leak');
  });

  it('catches a marker split across two chunks (seam scan)', () => {
    for (const marker of LEAK_MARKERS) {
      // Split at several points, including k = 1 (one char before the seam).
      for (const k of [1, 2, Math.floor(marker.length / 2), marker.length - 1]) {
        const guard = createStreamGuard();
        const first = guard.inspect(marker.slice(0, k));
        const second = guard.inspect(marker.slice(k));
        expect(first.ok, `first half should pass for marker "${marker}" split@${k}`).toBe(true);
        expect(second.ok, `second half should trip for marker "${marker}" split@${k}`).toBe(false);
        if (!second.ok) expect(second.reason).toBe('leak');
      }
    }
  });

  it('catches a marker delivered one character per chunk (three-plus-way split)', () => {
    const marker = LEAK_MARKERS[0] ?? '';
    const guard = createStreamGuard();
    const verdicts = [...marker].map((ch) => guard.inspect(ch));
    // Every chunk before the final marker char is clean; the last trips.
    expect(verdicts.slice(0, -1).every((v) => v.ok)).toBe(true);
    const last = verdicts.at(-1);
    expect(last?.ok).toBe(false);
    if (last && !last.ok) expect(last.reason).toBe('leak');
  });

  it('catches a leak reformatted with inserted whitespace/newlines', () => {
    const marker = LEAK_MARKERS[0] ?? '';
    // Replace each internal space with a newline + extra spaces — a model
    // could reflow a leak across lines. Whitespace-normalized matching catches it.
    const reflowed = marker.replace(/ /g, '\n   ');
    const guard = createStreamGuard();
    const verdict = guard.inspect(`prefix ${reflowed} suffix`);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('leak');
  });

  it('is case-insensitive', () => {
    const marker = LEAK_MARKERS[0] ?? '';
    const guard = createStreamGuard();
    const verdict = guard.inspect(marker.toUpperCase());
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('leak');
  });
});

describe('Layer 1: createStreamGuard — length cap', () => {
  it('aborts once cumulative chunk length exceeds MAX_ANSWER_CHARS', () => {
    const guard = createStreamGuard();
    const chunk = 'x'.repeat(1000); // safe filler, no markers
    let tripped = -1;
    let i = 0;
    // Feed 1000-char chunks until the cap trips.
    while (tripped === -1 && i < Math.ceil(MAX_ANSWER_CHARS / 1000) + 2) {
      const v = guard.inspect(chunk);
      if (!v.ok) {
        expect(v.reason).toBe('length');
        tripped = i;
      }
      i++;
    }
    expect(tripped).toBeGreaterThan(-1);
    // The cap trips on the chunk that crosses MAX_ANSWER_CHARS, not before.
    expect((tripped + 1) * 1000).toBeGreaterThan(MAX_ANSWER_CHARS);
  });

  it('counts chunk.length, not haystack.length (no double-count at the overlap)', () => {
    // Feed exactly MAX_ANSWER_CHARS in safe filler across many small chunks.
    // If the guard counted the carried-over tail (haystack) each step, the
    // cumulative count would overshoot and trip early. It must not.
    const guard = createStreamGuard();
    const piece = 'a'.repeat(50);
    const steps = Math.floor(MAX_ANSWER_CHARS / piece.length);
    let lengthTrip = false;
    for (let s = 0; s < steps; s++) {
      const v = guard.inspect(piece);
      if (!v.ok && v.reason === 'length') lengthTrip = true;
    }
    // We fed exactly MAX_ANSWER_CHARS (or just under) — must NOT have tripped.
    expect(lengthTrip).toBe(false);
    // One more piece crosses the cap and trips.
    const over = guard.inspect(piece);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe('length');
  });
});

describe('Layer 1: createStreamGuard — fail-open on internal error', () => {
  it('returns ok when given a non-string (guard bug must never block answers)', () => {
    // A guard whose internal scan throws must fail OPEN: a guard bug must not
    // degrade a legitimate answer into an error line. Feeding a non-string
    // (a contract violation) exercises the internal try/catch fail-open path.
    const guard = createStreamGuard();
    // @ts-expect-error — deliberately violating the string contract to trip the
    // internal error path; the guard must catch and fail open.
    const verdict = guard.inspect(null);
    expect(verdict.ok).toBe(true);
  });
});

describe('Layer 2: validateAnswer — post-hoc full-answer audit', () => {
  it('flags a leak marker present anywhere in the buffered answer', () => {
    const answer = `Here is something I should not say: ${LEAK_MARKERS[0]}`;
    const verdict = validateAnswer(answer, 'completed');
    expect(verdict.clean).toBe(false);
    expect(verdict.findings.length).toBeGreaterThan(0);
    expect(verdict.findings.some((f) => f.kind === 'leak')).toBe(true);
  });

  it('passes a clean, normal answer with no findings', () => {
    const answer = 'Erik has 8+ years of experience in production software systems.';
    const verdict = validateAnswer(answer, 'completed');
    expect(verdict.clean).toBe(true);
    expect(verdict.findings).toEqual([]);
  });

  it('flags an empty answer when status is completed', () => {
    const verdict = validateAnswer('', 'completed');
    expect(verdict.clean).toBe(false);
    expect(verdict.findings.some((f) => f.kind === 'empty')).toBe(true);
  });

  it('does NOT flag an empty answer when status is errored (expected on abort)', () => {
    // An aborted/errored stream legitimately leaves an empty answer; the
    // empty-on-completed check must not fire for non-completed statuses.
    const verdict = validateAnswer('', 'errored');
    expect(verdict.findings.some((f) => f.kind === 'empty')).toBe(false);
  });

  it('flags an over-length buffered answer', () => {
    const answer = 'b'.repeat(MAX_ANSWER_CHARS + 1);
    const verdict = validateAnswer(answer, 'completed');
    expect(verdict.clean).toBe(false);
    expect(verdict.findings.some((f) => f.kind === 'length')).toBe(true);
  });

  it('fails open (clean, no throw) when given a non-string answer', () => {
    // @ts-expect-error — contract violation; Layer 2 must not throw into the
    // response path. It returns a clean verdict rather than crashing settle.
    const verdict = validateAnswer(null, 'completed');
    expect(verdict.clean).toBe(true);
    expect(verdict.findings).toEqual([]);
  });
});
