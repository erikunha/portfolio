// evals/agents/rule-pruning-knownhard/CASE.ts
//
// knownHard:true, JUDGE grader (spec §4 anti-saturation). A deliberately
// ambiguous rule-hygiene application the current platform prompt is known to
// get wrong SOMETIMES: the rule-hygiene policy says prune prose already covered
// by a gate/skill, but agents frequently rationalize keeping a "harmless"
// readability rule. The correct answer is to PRUNE it (covered by the linter +
// review battery, prose is the most expensive slot, unfired for 90 days).
//
// This case must NOT saturate at 100% across N runs — it is the discrimination
// signal that proves the eval still distinguishes a well-applied rule from a
// rubber-stamp. If it ever hits 100% consistently, re-seed a harder case.

import { validateAgentEvalCase } from '@/evals/agents/schema';

export default validateAgentEvalCase({
  id: 'rule-pruning-knownhard',
  prompt:
    'CLAUDE.md loads every session and fights monotonic growth. It contains the prose rule "Prefer clear, readable variable names over abbreviations." A linter and the code-review battery already flag unclear naming, and the rule has not been cited in any review in 90 days. Keep it as prose or prune it? Justify against the rule-hygiene policy.',
  target: {
    name: 'CLAUDE.md:rule-hygiene-prune-covered-prose',
    systemText:
      "Rule hygiene: pick the cheapest slot that still fires — mechanical gate > on-demand skill > contextual memory > prose. Prose taxes every session regardless of relevance and is the last resort. If a skill or gate already covers a rule's context, do not also write the prose. Rules are removed, not only added: when a prose rule becomes covered by a gate or skill, delete the prose — pruning is a normal edit.",
  },
  tier: 'judgment',
  grader: 'judge',
  expect:
    'Concludes the rule should be PRUNED: it is already covered by the linter and the review battery, prose is the most expensive slot, and it has not fired in 90 days. Cites the rule-hygiene policy. Does NOT rationalize keeping it as "harmless."',
  knownHard: true,
});
