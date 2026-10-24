# CI profile (claude-review workflow)

`.github/workflows/claude-review.yml` runs this procedure on every PR push, inside
`anthropics/claude-code-action`. The local procedure assumes capabilities CI does not have, so
each step maps to its CI substitute. The merge gate and output contract live in
`.github/claude-review-prompt.md`; this file only changes how the evidence is gathered.

## What CI has

| Capability | In CI |
|---|---|
| Base checkout (trusted conventions) | repository root |
| This skill (trusted procedure) | `/tmp/review-skill`, materialised from the default branch (a sub-PR's base may be an integration branch that edited it) |
| PR files (data under review) | `pr-head/`, instruction-shaped files stripped |
| Installed dependencies | none: installing would run PR-controlled code (a `.pnpmfile.cjs` loads despite `--ignore-scripts`) in a job holding the reviewer's credentials |
| Subagents | `Task` with `subagent_type: review-worker` (`Read`, `Grep`, `Glob` only). The built-in types that inherit every tool, the inline-comment tool included, are denied (`Task(general-purpose)`, `Task(Explore)`, `Task(Plan)` and the rest), and every project agent declares a `tools:` list without it, so only the main thread can post |
| PR metadata, diff and gate results | `/tmp/review-evidence/pr.json`, `diff.patch`, `files.txt`, `checks.txt` (starts with `UNAVAILABLE` when no valid check list came back) and `failed-run-<id>.log`. A failed read leaves a marker instead and the step continues: `pr-unavailable.txt`, `diff-unavailable.txt` or `failed-runs-unavailable.txt`. These are written by the workflow's snapshot step before the review; the reviewer has no `gh` command that takes `--jq`, which could read its environment |
| Tools | `Read`, `Grep`, `Glob`, `Task` and the inline-comment tool. Denied, which overrides what tag mode adds: edits, every `Bash` command including the action's git and push-wrapper tools, web tools, and reads of `.git/`, `/proc`, credential and config files in the home directory (not the home directory itself, which holds the workspace) and the runner temp directory. No `gh` command and no network fetch is granted |
| Codex, MiMo, local build, browser, servers | not available |

## Step mapping

| Local step | CI substitute |
|---|---|
| Calibrate | fixed: the table above |
| Resolve target | `/tmp/review-evidence/pr.json`, `diff.patch` and `files.txt` |
| Domain matrix | same (`domains.md`) |
| Cross-provider tracks | `Task` subagents, one falsifiable question each, launched in one message for independent domains. The reviewer is still one provider family; say so in the overview when the change is consequential and suggest the local orchestrator. |
| Gates | read the snapshot; a failed or pending gate the change touches is evidence, a passed one is not proof of the journeys it does not exercise, a check pending at snapshot time is a limit |
| Local run and browser | not run: the e2e, visual and LHCI jobs are the runtime evidence; anything they do not cover stays a limit |
| Dependency research | manifest and lockfile diff; overrides checked against the dependent's range as the lockfile records it; whatever needs installed source or release notes is a named limit, settled by the local orchestrator |
| Refute and challenge | re-read the decisive lines yourself; one extra `Task` challenger for each CRITICAL before posting |
| Output | the inline-comment and verdict contract in the CI prompt, never the local draft format |

## Budget

The job has a timeout; size fan-out to it. A trivial PR needs no subagent. A dependency upgrade,
an `app/api/**` change or a cross-system PR earns one subagent per MATERIAL domain.
