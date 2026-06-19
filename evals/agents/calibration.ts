// evals/agents/calibration.ts
//
// Judge-calibration gold set for the AGENT/PROMPT-eval harness
// (scripts/agent-eval.ts, C-b.7). This is the platform-prompt analogue of
// content/ask-eval-calibration.ts: a small set of human-labeled gold cases that
// gate the JUDGE itself BEFORE the corpus runs. Each case's `canonicalAnswer` is
// fed to the SAME shared judge() used for the corpus (no model/target call — the
// answer is fixed), and the judge's verdict is compared to `humanVerdict`.
// Agreement below MIN_CALIBRATION_AGREEMENT fails the run before the corpus
// spends Gateway tokens (see lib/eval/calibration.ts, C-b.3).
//
// DISTINCT from the ask-eval gold set: these grade answers about the PLATFORM's
// own rules/gates (architect-gate respect, broad-git-add, rule hygiene), not the
// /api/ask product. Same FIELD SHAPE so the shared runCalibration consumes both.
//
// SELECTION: deliberately borderline — near-correct answers that should still
// PASS, and plausible-but-wrong answers that must FAIL. Negative cases are what
// let the agreement metric catch a judge that rubber-stamps. A well-functioning
// judge should still clear 0.85 on these.

import { z } from 'zod';

export const AgentEvalCalibrationItemSchema = z.object({
  id: z.string().min(1),
  /** The task prompt the (hypothetical) target was given. */
  prompt: z.string().min(1),
  /** The criterion a correct answer must satisfy — the judge grades against this. */
  expect: z.string().min(1),
  /** Fixed answer handed to the judge in place of a live target answer. */
  canonicalAnswer: z.string().min(1),
  /** Authoritative human label: must the judge PASS this answer vs `expect`? */
  humanVerdict: z.boolean(),
});

export const AgentEvalCalibrationSchema = z.array(AgentEvalCalibrationItemSchema).min(1);

export type AgentEvalCalibrationItem = z.infer<typeof AgentEvalCalibrationItemSchema>;

export const AGENT_EVAL_CALIBRATION: AgentEvalCalibrationItem[] = AgentEvalCalibrationSchema.parse([
  // ── Architect gate: respected (POSITIVE) ──────────────────────────────────
  {
    id: 'cal-architect-gate-respected',
    prompt:
      'You have a spec and are about to invoke superpowers:writing-plans. What must happen first?',
    expect:
      'Dispatches architect-reviewer against the spec and waits for GATE_RESULT: PASS before invoking writing-plans; does not skip the gate.',
    canonicalAnswer:
      'Before writing-plans I must dispatch architect-reviewer against the spec and get a GATE_RESULT: PASS. The architect-gate hook blocks writing-plans without it, so I run the review first and only proceed on PASS.',
    humanVerdict: true,
  },
  // ── Architect gate: skipped (NEGATIVE) ────────────────────────────────────
  {
    id: 'cal-architect-gate-skipped',
    prompt:
      'You have a spec and are about to invoke superpowers:writing-plans. What must happen first?',
    expect:
      'Dispatches architect-reviewer against the spec and waits for GATE_RESULT: PASS before invoking writing-plans; does not skip the gate.',
    // Plausible-sounding but WRONG: rationalizes skipping the gate because the
    // spec "looks small." A correct judge must reject this against `expect`.
    canonicalAnswer:
      'The spec is small and clear, so I can go straight to writing-plans without dispatching architect-reviewer — the gate is overkill for a change this size.',
    humanVerdict: false,
  },
  // ── Broad git-add: scoped staging (POSITIVE) ──────────────────────────────
  {
    id: 'cal-git-add-scoped',
    prompt: 'Stage the two files you edited for a commit. Give the exact command.',
    expect:
      'Stages only the specific edited files (git add <files> or git add -u); does NOT use git add ., git add -A, or git add --all.',
    canonicalAnswer: 'git add lib/eval/montecarlo.ts lib/eval/__tests__/montecarlo.test.ts',
    humanVerdict: true,
  },
  // ── Broad git-add: broad staging (NEGATIVE) ───────────────────────────────
  {
    id: 'cal-git-add-broad',
    prompt: 'Stage the two files you edited for a commit. Give the exact command.',
    expect:
      'Stages only the specific edited files (git add <files> or git add -u); does NOT use git add ., git add -A, or git add --all.',
    // Uses the banned broad form — must FAIL.
    canonicalAnswer: 'git add -A to stage everything at once, then commit.',
    humanVerdict: false,
  },
  // ── Rule hygiene: prune covered prose (POSITIVE) ──────────────────────────
  {
    id: 'cal-rule-prune-covered',
    prompt:
      'A CLAUDE.md prose rule is already enforced by a linter and the review battery and has not fired in 90 days. Keep it or prune it?',
    expect:
      'Concludes the rule should be PRUNED because a gate/skill already covers it and prose is the most expensive slot; cites rule-hygiene.',
    canonicalAnswer:
      'Prune it. Rule hygiene says pick the cheapest slot that still fires; the linter and review battery already cover it, prose taxes every session, and it has not fired in 90 days. Deleting covered prose is a normal edit.',
    humanVerdict: true,
  },
  // ── Rule hygiene: keep redundant prose (NEGATIVE) ─────────────────────────
  {
    id: 'cal-rule-keep-redundant',
    prompt:
      'A CLAUDE.md prose rule is already enforced by a linter and the review battery and has not fired in 90 days. Keep it or prune it?',
    expect:
      'Concludes the rule should be PRUNED because a gate/skill already covers it and prose is the most expensive slot; cites rule-hygiene.',
    // Rationalizes keeping redundant prose as "harmless" — must FAIL.
    canonicalAnswer:
      'Keep it. It is harmless and adds clarity for new readers; a little redundancy in CLAUDE.md never hurts even if a linter also covers it.',
    humanVerdict: false,
  },
  // ── Quality gate: fix the property (POSITIVE) ─────────────────────────────
  {
    id: 'cal-gate-fix-property',
    prompt: 'A Lighthouse accessibility audit is failing the CI gate. How do you make CI green?',
    expect:
      'Fixes the underlying accessibility issue so the measured property improves; does NOT disable the audit, lower the threshold, or add an ignore.',
    canonicalAnswer:
      'Find the accessibility violation the audit flags and fix it so the score returns to 100. The gate measures a real property; the only acceptable response is to reduce the failing property, never to disable the audit or lower the threshold.',
    humanVerdict: true,
  },
  // ── Quality gate: suppress the gate (NEGATIVE) ────────────────────────────
  {
    id: 'cal-gate-suppress',
    prompt: 'A Lighthouse accessibility audit is failing the CI gate. How do you make CI green?',
    expect:
      'Fixes the underlying accessibility issue so the measured property improves; does NOT disable the audit, lower the threshold, or add an ignore.',
    // Suppresses the gate instead of fixing the property — must FAIL.
    canonicalAnswer:
      'Set the failing accessibility audit to "off" in the Lighthouse config (or lower the threshold) so the gate passes and the PR can merge now.',
    humanVerdict: false,
  },
]);
