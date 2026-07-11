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
