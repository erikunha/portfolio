# Development Lifecycle

How a change flows from requirement to production. Git hooks and CI enforce checks; project instructions also require procedural review steps.

## The lifecycle at a glance

Planning, up to the first line of code:

```mermaid
flowchart LR
    idea["Idea"] --> brainstorm["Brainstorm"] --> spec["Spec (local)"]
    spec --> agate{"plan-review PASS?"}
    agate -->|no| spec
    agate -->|yes| plan["Plan"] --> branch["Feature branch"] --> tdd["TDD"]
```

From the first commit to an open pull request:

```mermaid
flowchart LR
    commit["commit"] --> hooks["pre-commit, commit-msg"] --> push["git push"]
    push --> verify["pre-push: verify"] --> full["ci:full"] --> pr["gh pr create"]
```

From review to a recorded decision:

```mermaid
flowchart LR
    review["Review, answer findings"] --> ready["CI green, Argos approved"]
    ready --> merge["Squash-merge by owner"] --> deploy["Vercel deploy"]
    deploy --> smoke["Smoke test"] --> adr["ADR recorded"]
```

- The recorded decision feeds the next idea.
- The spec and plan live in a local, untracked feature directory.
- `plan-review` must return `GATE_RESULT: PASS`; this is a convention, not a hook.
- The branch is `feat|fix|...` plus `/description`, one logical unit per commit: `type(scope): subject`.
- The per-commit hooks are Biome on staged files, staged gitleaks and commitlint.
- `ci:full` runs before the PR; `gates:runtime` also runs for a change that is not docs-only.
- The PR template is filled in full. Merge needs CI green, Argos approved and every finding answered.

## Phase by phase

### 1. Idea -> Brainstorm

Work starts with a short brainstorm. The output is a shared understanding of intent, requirements, and the chosen approach, with failure modes considered up front.

### 2. Spec (the approved requirements)

Write the feature requirements and acceptance criteria. Specs stay local: `.gitignore` excludes `specs`, `.specify` and generated spec-kit skills, and the tool that writes a spec is each engineer's choice.

### 3. The plan gate

Before a plan is written, the `plan-review` skill runs the four-gate protocol against the spec and must return `GATE_RESULT: PASS`. This is a convention, not a project hook.

### 4. Plan (the decomposed "how")

Decompose the requirements into independently verifiable tasks under the feature directory. Large changes use an integration branch and focused sub-PRs, as described in `AGENTS.md`.

### 5. Branch + TDD implementation

A feature branch is created (`<type>/<description>`, enforced by `.husky/pre-push`). Implementation is test-first (`test-first discipline (AGENTS.md)` is mandated before writing any new file/function/script). The agent works in scope blocks, one logical unit per commit.

### 6. Commit (per-commit gates)

- **`pre-commit`**: `pnpm check:staged` (Biome on the staged files) and staged gitleaks scanning.
- **`commit-msg`**: commitlint. Conventional Commits with a **mandatory scope** (`scope-empty: [2, 'never']`) drawn from an **open set** (`scope-enum: [0]`), and the subject must not start sentence-case, start-case, PascalCase or upper-case. Scopes are feature-area names (`ci`, `dx`, `observability`, `healthz`, `ppr`, `arch`, ...), not technical categories.

### 7. Pre-PR diff read, and the pre-push gate chain

Before opening the PR, read the diff. For non-deletion pushes, `.husky/pre-push` checks the main target, branch name and `pnpm verify`. The verify chain includes `pnpm check:test-integrity` (`scripts/gates/check-test-integrity.ts`, also a `quality-fast` step in CI): it fails a focused test, a test body with no assertion (a call to a helper that asserts counts, whether it is local, imported by name or default, or reached through a re-export) and a skip without a reason string. Deletion-only pushes skip branch naming and verify after the main-target guard. Adding or upgrading a direct dependency also means updating its entry in `dependency-vetting.json` (purpose, license), because `pnpm verify` runs `check:dependency-vetting`.

### 8. Pre-PR -> open PR

Run `pnpm ci:full`: it runs every CI check one stage at a time (the verify chain, commitlint, gitleaks, audit, the build with the bundle and route-JS gates, a11y, every Playwright project, the visual specs and Lighthouse) and ends with a table of passed, failed and not-run stages (exit 0 only when every stage passed, 1 when one failed, 3 when one did not run, 2 for bad arguments). The paid evals and the GitHub-only jobs are listed not-run with their reason. `pnpm gates:runtime` stays the quick single-project run (build, server, LHCI desktop/mobile, axe, E2E). Docs-only changes skip bundle, route-JS and runtime gates under the project workflow. Then `gh pr create` fills the PR template; every section must be non-empty, which is a convention checked by the author and the reviewer, not a gate.

### 9. Review threads

On the open PR, review it against `REVIEW.md`, running every repository skill whose trigger matches the diff and looking at the rendered result. Answer every blocking finding. claude-review runs only when an owner, member or collaborator comments `/claude-review`, with no automatic follow-up round.

### 10. Pre-merge gates -> merge

The gates are `pnpm ci:local` and CI, with CI green, the Argos visual check approved and the base contained, plus a review whose blocking findings are answered. The conversation state is not a gate: nothing in CI reads the review threads.

### 11. Deploy -> smoke -> record

Vercel deploys on merge to `main`. `attest-build` in `ci.yml` attests the build artifact on `main` only. The `smoke.yml` workflow verifies the production deployment (healthz, 7 security headers, apex->www promotion followed to its final 200, `/api/ask` + `/api/contact` liveness): the artifact probe is skipped for a protected `*.vercel.app` deployment without its bypass secret, and a canonical healthz 503 attempts a Resend alert only when `RESEND_API_KEY` and the `ALERT_EMAIL` repository secret are both configured, with delivery errors logged as warnings. The decision is recorded as an ADR in `DECISIONS.md` (with a reversibility note); no project file establishes a session-handoff location.

## The responsive critique pass

A UI change is read at every width before its PR opens. Each section gets a critique pass, the findings are fixed, and the fixes land in one PR.

**Widths.** 320, 375, 390, 412, 768, 1024 and 1280. The narrow widths catch a label or a target that no longer fits, 768 catches the layout that only breaks in the middle, and 1280 is the desktop reference.

**Lenses.** Read every section through five lenses:

| Lens                     | The question it asks                                             |
| ------------------------ | ---------------------------------------------------------------- |
| Information architecture | Is the content in an order a reader can follow?                  |
| Responsive layout        | Does the layout hold at each width above?                        |
| Accessibility            | Can every control be reached, named and operated?                |
| Heuristics               | Does the surface show what happened and what to do next?         |
| Copy                     | Does the wording say what the reader needs, in the fewest words? |

**Captures.** A section capture hides the fixed chrome, so it shows the section and not the chrome over it. `stripVolatileChrome` in `tests/e2e/_helpers/mask-volatile.ts` is the list of chrome hidden before a capture; add any new fixed or sticky bar to it.

A finding that changes behavior is a decision, so it lands in `DECISIONS.md` as a dated bullet. A finding that touches a CI-gated baseline follows the `visual-baseline-regen` skill.

## The gate chain between "written" and "merged"

```mermaid
flowchart LR
    subgraph commit["per-commit"]
        g1["Biome + staged gitleaks"] --> g2["commitlint"]
    end
    subgraph prepush["pre-push (blocks)"]
        g3["no direct main"] --> g4["branch name"] --> g7["pnpm verify"]
    end
    subgraph prepr["pre-PR (manual)"]
        g8["ci:full (every CI check, in sequence)"] --> g11["gates:runtime (LHCI)"]
    end
    subgraph open["post-open"]
        g13["Review the pull request"]
    end
    subgraph premerge["pre-merge"]
        g15["ci:local"] --> g18["findings answered"]
    end
    commit --> prepush --> prepr --> open --> premerge --> merge["squash-merge"]
```
