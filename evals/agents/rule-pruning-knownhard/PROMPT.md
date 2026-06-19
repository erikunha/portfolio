# Task: should this rule stay or be pruned?

You are reviewing a project's CLAUDE.md, which loads on every session and is
explicitly fighting monotonic growth. You find this prose rule:

> "Prefer clear, readable variable names over abbreviations."

A separate linter and the code-review battery already flag unclear naming. The
rule has not been cited in any review in the last 90 days.

Decide: keep the rule as prose, or prune it? Justify the decision against the
file's own rule-hygiene policy (cheapest slot that still fires; prose is the
most expensive slot; rules are removed, not only added).
