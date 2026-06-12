#!/usr/bin/env bash
# PreToolUse hook for Bash tool.
# Receives tool input JSON on stdin. Exit 0 = allow. Exit 2 = block. Exit 1 = non-blocking warning.
# Output is shown to Claude as the blocking reason.

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  print(json.load(sys.stdin).get('command', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

# ── Block: broad git add variants ────────────────────────────────────────────
# CLAUDE.md: use git add -u or git add <specific files> only.
# git add . / -A / --all risks staging screenshots, worktree artifacts, and
# parallel-agent writes that were never meant to land in this commit.
if printf '%s' "$CMD" | grep -qE 'git\s+add\s+(-A\b|--all\b|\.\s*$|\.\s+)'; then
  printf '[BLOCKED] Broad git add detected.\n'
  printf 'CLAUDE.md: use git add -u or git add <specific files> only.\n'
  printf 'git add . / -A / --all stages unintended files (screenshots, worktree artifacts).\n'
  exit 2
fi

# ── Block: npm or yarn — wrong package manager ────────────────────────────────
# This project uses pnpm only. npm/yarn create competing lockfiles and break CI.
if printf '%s' "$CMD" | grep -qE '^\s*(npm|yarn)\s+'; then
  SUBCMD=$(printf '%s' "$CMD" | sed -E 's/^[[:space:]]*(npm|yarn)[[:space:]]+//')
  printf '[BLOCKED] npm/yarn detected. This project uses pnpm only.\n'
  printf 'Use instead: pnpm %s\n' "$SUBCMD"
  exit 2
fi

# ── Block: gh pr merge called directly by an AI agent ───────────────────────
# The repo owner may bypass by running gh pr merge in an external terminal.
# AI agents must use pnpm ready-to-merge which enforces the full gate chain.
if printf '%s' "$CMD" | grep -qE 'gh pr merge'; then
  printf '[BLOCKED] gh pr merge called directly.\n'
  printf 'AI agents must run: pnpm ready-to-merge [pr-number]\n'
  printf 'This enforces: ci:local + branch-protection + Copilot review gate + resolved threads.\n'
  printf 'The repo owner may run gh pr merge directly in an external terminal to bypass.\n'
  exit 2
fi

# ── Block: force push to main ────────────────────────────────────────────────
if printf '%s' "$CMD" | grep -qP 'git push.*(--force|-f)\b.*\bmain\b|git push.*\bmain\b.*(--force|-f)\b' 2>/dev/null || \
   printf '%s' "$CMD" | grep -E 'git push.*(--force|--force-with-lease).*main|git push.*main.*(--force|--force-with-lease)' > /dev/null 2>&1; then
  printf '[BLOCKED] Force push to main is not allowed.\n'
  printf 'Rebase the feature branch onto main and merge via PR instead.\n'
  exit 2
fi

# ── fallow CLI: enforce pinned + read-only (FAIL-CLOSED allow-list) ──────────
# fallow is an on-demand audit tool (see .claude/skills/fallow-audit). The ONLY
# allowed form is a single, un-chained:  npx fallow@<PIN> <read-only-subcommand>
# Anything else is denied: write/runtime subcommands (fix/init/hooks/migrate/
# watch/ci/coverage/license/telemetry), --fix/cloud flags, FALLOW_* env, config
# flags, alternate runners (pnpm dlx/bunx/yarn dlx), unpinned/global/wrong-version,
# and any shell chaining/substitution. WHY: npx has no lockfile protection and
# fix mutates source; this is the mechanical gate (PreToolUse exit 2), not the
# SKILL.md prose. The allow-list is fail-closed — unrecognized shapes are denied,
# so new fallow subcommands are blocked until reviewed; flags use the section C
# deny-list (new flags pass unless explicitly blocked). PIN drives the regex.
# Residual limit: a renamed/copied binary (cp .../fallow /tmp/f && /tmp/f fix) has
# no `fallow` token and cannot be name-matched — see DECISIONS.md.
FALLOW_PIN='2.95.0'
FALLOW_PIN_RE=$(printf '%s' "$FALLOW_PIN" | sed 's/\./\\./g')
# Normalize whitespace and append a trailing space so end-of-token == a space.
FALLOW_CMD=$(printf '%s ' "$CMD" | tr '\n\t' '  ')
if printf '%s' "$FALLOW_CMD" | grep -qE '(^|[[:space:]&|;/])fallow[[:space:]@]'; then
  # A. No shell chaining / substitution / REDIRECTION alongside fallow. Kills the
  #    decoy-token bypass (valid pinned call + a second malicious clause) AND the
  #    redirect-write primitive (`fallow audit > ~/.zshrc` truncates an arbitrary
  #    file with fallow output). Redirect chars < > are blocked with ; | & ` $(.
  if printf '%s' "$FALLOW_CMD" | grep -qE '[;|&`<>]|\$\('; then
    printf '[BLOCKED] Run fallow bare — no chaining/substitution/redirection (; | & ` $() < >).\n'
    printf 'Read its output directly: npx fallow@%s audit\n' "$FALLOW_PIN"
    exit 2
  fi
  # B. No FALLOW_* env (exfil/runtime/config namespace) and no config-file flag
  #    (a .fallowrc can enable auto-fix or a remote extends: URL).
  if printf '%s' "$FALLOW_CMD" | grep -qE '(^|[[:space:]])FALLOW_[A-Z0-9_]+=' \
     || printf '%s' "$FALLOW_CMD" | grep -qE -- '(^|[[:space:]])(-c|--config|--fallowrc)([[:space:]=])'; then
    printf '[BLOCKED] fallow env (FALLOW_*) or config-file flag — exfil + untrusted-config surface.\n'
    exit 2
  fi
  # C. No destructive / file-writing / runtime / cloud / CI flags anywhere.
  # NB: read-only subcommands DO expose file-write flags (--sarif-file writes an
  # arbitrary path; --save-*baseline/--save-snapshot write files, and
  # --save-regression-baseline with no path writes INTO .fallowrc). --save- is a
  # forward-compatible prefix; --ci is anchored so it does not match --circular-deps.
  # This is a deny-list (the subcommand gate D is the allow-list); new fallow flags
  # are covered by the re-audit-on-bump protocol in DECISIONS.md.
  # NB on the posting-format tokens below: --format[[:space:]=](...) catches the
  # canonical --format flag; the bare-token alternatives catch any short/alias flag
  # (-f, --reporter, etc.) that could select the same posting output from an opaque
  # binary that DECISIONS.md explicitly marks as "unauditable via static review".
  # Both forms are intentional defense-in-depth — removing either narrows coverage.
  # Bare-token form uses leading [[:space:]=] (catches alias=-value like -f=review-github)
  # and trailing [[:space:],] (catches comma-joined reporters like review-github,sarif;
  # path args /some/review-github-actions/ end in / or - which do not match; FALLOW_CMD
  # trailing space (line 69) ensures the last token is always space-terminated).
  if printf '%s' "$FALLOW_CMD" | grep -qE -- '--fix|--upload|--cloud|--runtime|--remote|--comment|--review|--write|--apply|--save-|--sarif-file|--ci[[:space:]=]|--format[[:space:]=](review-github|pr-comment-github|review-gitlab|pr-comment-gitlab)|[[:space:]=](review-github|pr-comment-github|review-gitlab|pr-comment-gitlab)[[:space:],]'; then
    printf '[BLOCKED] fallow write/cloud/CI/GitHub+GitLab-posting flag detected (e.g. --sarif-file, --save-*, --ci, --format review-github) — read-only audit only.\n'
    exit 2
  fi
  # D. Subcommand allow-list: the command must start with the pinned npx form and
  #    include a read-only subcommand (prefix-anchored, not end-anchored — flags
  #    after the subcommand are governed by section C above). Rejects unpinned,
  #    global, wrong-version, pnpm dlx/bunx/yarn dlx, and write subcommands.
  if ! printf '%s' "$FALLOW_CMD" | grep -qE "^[[:space:]]*npx[[:space:]]+(--yes[[:space:]]+|-y[[:space:]]+)?fallow@${FALLOW_PIN_RE}[[:space:]]+(audit|dead-code|dupes|health|flags|list|workspaces|explain|config|schema)[[:space:]]"; then
    printf '[BLOCKED] fallow must be exactly: npx fallow@%s <read-only subcommand>\n' "$FALLOW_PIN"
    printf 'Allowed: audit dead-code dupes health flags list workspaces explain config schema.\n'
    printf 'Rejected: unpinned/global fallow, other versions, pnpm dlx/bunx/yarn dlx, write subcommands.\n'
    exit 2
  fi
fi

# ── Warn: (design-system) commit scope — changelog:sync required ─────────────
# CLAUDE.md: after any (design-system) commit, run pnpm changelog:sync.
# This warn fires before the commit so the agent queues the follow-up immediately.
if printf '%s' "$CMD" | grep -qE "git commit.*-m"; then
  DS_MSG=$(python3 -c "
import sys, shlex
cmd = sys.argv[1] if len(sys.argv) > 1 else ''
try:
    parts = shlex.split(cmd)
    for i, p in enumerate(parts):
        if p == '-m' and i + 1 < len(parts):
            print(parts[i + 1])
            break
except Exception:
    pass
" "$CMD" 2>/dev/null || echo "")
  if printf '%s' "$DS_MSG" | grep -qE '\(design-system\)'; then
    printf '[WARN] Commit scope is (design-system).\n'
    printf 'CLAUDE.md: run pnpm changelog:sync after this commit lands.\n'
    printf 'This regenerates app/design-system/changelog/page.mdx from git history.\n'
  fi
fi

# ── Warn: commit header > 100 chars ─────────────────────────────────────────
# commitlint enforces this post-hoc; catching it here avoids the wasted round-trip.
if printf '%s' "$CMD" | grep -qE "git commit.*-m"; then
  HEADER=$(python3 -c "
import sys, shlex
cmd = sys.argv[1] if len(sys.argv) > 1 else ''
try:
    parts = shlex.split(cmd)
    for i, p in enumerate(parts):
        if p == '-m' and i + 1 < len(parts):
            print(parts[i + 1].split(chr(10))[0])
            break
except Exception:
    pass
" "$CMD" 2>/dev/null || echo "")
  HEADER_LEN=${#HEADER}
  if [ -n "$HEADER" ] && [ "$HEADER_LEN" -gt 100 ]; then
    printf '[WARN] Commit header is %s chars (limit: 100). commitlint will reject this.\n' "$HEADER_LEN"
    printf 'Shorten the subject line to 100 chars or fewer before running.\n'
  fi
fi

# ── Warn: gh pr create without ready-for-pr ──────────────────────────────────
# Not a hard block — the user may have already run ready-for-pr manually.
# The warning surfaces in Claude's context so it can confirm before proceeding.
if printf '%s' "$CMD" | grep -qE 'gh pr create'; then
  printf '[WARN] Before gh pr create, verify:\n'
  printf '  1. pnpm ready-for-pr passed (ci:local + pr-size + gates:runtime)\n'
  printf '  2. pr-review-toolkit:review-pr ran — Critical/Important findings addressed\n'
  printf '  3. PR body written FROM the template (cat .github/pull_request_template.md first)\n'
  printf 'MANDATORY after creation: pnpm validate-pr-body <pr-number>\n'
  printf 'Do not request reviewer until validate-pr-body exits 0.\n'
  # exit 0 = warn only, tool still runs
fi

exit 0
