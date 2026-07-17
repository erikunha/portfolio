---
name: semgrep
description: Run the pinned Semgrep CLI to statically measure security issues (taint/injection, hardcoded secrets, OWASP Top Ten) on changed files, and interpret the SARIF output. Use ONLY when the user explicitly asks to "run semgrep", "static-analysis the diff", scan for injection/secrets, or interpret a Semgrep SARIF report. Do NOT auto-activate on generic "review my code" — the 4-agent battery and Biome cover that. CI is the authoritative gate; this skill is the local/agent interface.
---
> **Codex note:** mirror of a `.claude/` harness file. Any "the hook blocks", "enforced", "WIRED", or "exit 2" claim here — including in this file's description — is a **Claude Code** control. Codex hook activation is not wired in this repo, so for Codex treat these as **hard rules to self-enforce**, not automated gates. See `AGENTS.md` / `DECISIONS.md`.


# Semgrep (static analysis, on-demand)

Semgrep deterministically measures injection sinks, taint flows, and hardcoded
secrets — the property the security-auditor agent *reasons about* but cannot
*measure*. It is a complement to the review battery, not a replacement. The CI
`semgrep` job (`.github/workflows/ci.yml`) is authoritative and uploads SARIF to
the code-scanning tab; this skill is the local/agent interface.

## Invocation — pinned only

Semgrep is pinned to `1.169.0`. Run through the repo wrapper, never a bare global call:

    pnpm lint:semgrep                       # scan app/ lib/ components/ scripts/, write semgrep.sarif
    node scripts/run-semgrep.mjs <paths>    # scan specific paths
    node scripts/run-semgrep.mjs --error --sarif out.sarif <paths>

Local install (optional — CI is authoritative): `pip install semgrep==1.169.0`.
If Semgrep is not installed, the wrapper exits 2 with an install hint; defer to CI.

## Rulesets

- **Vendored, content-pinned** (`.semgrep/owasp-top-ten.yml`, `.semgrep/secrets.yml`)
  — the security-load-bearing rules. Edit these files to change behavior; they are
  the source of truth, immune to registry-side drift.
- **Registry-latest packs** (`p/typescript`, `p/react`, `p/nextjs`) — framework
  lint, lower stakes. The Semgrep CLI has no pack version-pinning syntax, so these
  fetch the latest registry rules (mutable); findings may drift between runs. Drift
  is accepted for the framework packs (documented in the ADR), which is why the
  security-load-bearing rules are instead vendored + content-pinned in `.semgrep/`.

## Interpreting SARIF

- `runs[].results[]` — each is one finding. `level` (`error`/`warning`), `ruleId`,
  `message.text`, and `locations[].physicalLocation` (file + line).
- Zero results in `--error` mode → wrapper exits 0. Any result → exits 1.
- Triage a finding as real → fix the code; false positive → add a justified
  `// nosemgrep: <rule-id> — <reason>` at the site (never a blanket disable).

## Hard rules

- Never disable a rule globally to clear a finding. Fix the code or justify per-line.
- Never edit fixtures under `tests/fixtures/semgrep/` to dodge a finding — they are
  the wrapper's test ground truth.
- The CI job is currently **non-blocking** (`continue-on-error: true`). Do not promote
  it to blocking without a measured FP-rate baseline recorded in DECISIONS.md.
