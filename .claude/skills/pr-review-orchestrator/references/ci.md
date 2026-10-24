# CI profile (claude-review workflow)

`.github/workflows/claude-review.yml` runs this procedure on every PR push, inside
`anthropics/claude-code-action`. The local procedure assumes capabilities CI does not have, so
each step maps to its CI substitute. The merge gate and output contract live in
`.github/claude-review-prompt.md`; this file only changes how the evidence is gathered.

## What CI has

| Capability | In CI |
|---|---|
| Base checkout (trusted conventions, this skill) | repository root |
| PR files (data under review) | `pr-head/`, instruction-shaped files stripped |
| Installed dependencies | `pr-head/node_modules`, only when `package.json` or `pnpm-lock.yaml` changed, installed with `--ignore-scripts` (no package code ran) |
| Subagents | `Task`; each subagent gets the same read-only tools |
| Gate results | `gh pr checks <n>` and `gh run view <id> --log-failed` (CI already runs typecheck, unit, e2e, visual, LHCI, route JS, audit, semgrep) |
| Upstream docs and release notes | `WebFetch`, for the exact version in the lockfile |
| Codex, MiMo, local build, browser, servers | not available |

## Step mapping

| Local step | CI substitute |
|---|---|
| Calibrate | fixed: the table above |
| Resolve target | `gh pr view <n> --json baseRefName,headRefOid,files`, `gh pr diff <n>` |
| Domain matrix | same (`domains.md`) |
| Cross-provider tracks | `Task` subagents, one falsifiable question each, launched in one message for independent domains. The reviewer is still one provider family; say so in the overview when the change is consequential and suggest the local orchestrator. |
| Gates | read the check results; a failed or pending gate the change touches is evidence, a passed one is not proof of the journeys it does not exercise |
| Local run and browser | not run: the e2e, visual and LHCI jobs are the runtime evidence; anything they do not cover stays a limit |
| Dependency research | read `pr-head/node_modules/<pkg>` source and `package.json` peer ranges, plus release notes at the exact version via `WebFetch` |
| Refute and challenge | re-read the decisive lines yourself; one extra `Task` challenger for each CRITICAL before posting |
| Output | the inline-comment and verdict contract in the CI prompt, never the local draft format |

## Budget

The job has a timeout; size fan-out to it. A trivial PR needs no subagent. A dependency upgrade,
an `app/api/**` change or a cross-system PR earns one subagent per MATERIAL domain.
