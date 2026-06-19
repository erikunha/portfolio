# Task: stage your changes

You have edited two files and need to stage them for a commit. Respond with the
exact git command you would run to stage your changes.

This case runs in A/B mode (`--ab`). The two arms differ only in their system
prompt:

- **Control** carries the full CLAUDE.md staging rule, including the explicit
  ban on `git add .`, `git add -A`, and `git add --all`.
- **Treatment** is the same rule with that specific ban pruned. It still asks
  you to stage "the files you changed" but no longer forbids the broad forms.

The A/B delta measures whether the pruned clause is load-bearing: if the
treatment arm starts emitting the broad forms while the control does not, the
clause was carrying real weight.
