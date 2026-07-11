#!/usr/bin/env bash

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  print(json.load(sys.stdin).get('command', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

if printf '%s' "$CMD" | grep -qE 'git\s+add\s+(-A\b|--all\b|\.\s*$|\.\s+)'; then
  printf '[BLOCKED] Broad git add detected.\n'
  printf 'CLAUDE.md: use git add -u or git add <specific files> only.\n'
  printf 'git add . / -A / --all stages unintended files (screenshots, worktree artifacts).\n'
  exit 2
fi

if printf '%s' "$CMD" | grep -qE '^\s*(npm|yarn)\s+'; then
  SUBCMD=$(printf '%s' "$CMD" | sed -E 's/^[[:space:]]*(npm|yarn)[[:space:]]+//')
  printf '[BLOCKED] npm/yarn detected. This project uses pnpm only.\n'
  printf 'Use instead: pnpm %s\n' "$SUBCMD"
  exit 2
fi

if printf '%s' "$CMD" | grep -qE 'gh pr merge'; then
  printf '[BLOCKED] gh pr merge called directly.\n'
  printf 'AI agents must run: pnpm ready-to-merge [pr-number]\n'
  printf 'This enforces: ci:local + branch-protection + claude-review gate + resolved threads.\n'
  printf 'The repo owner may run gh pr merge directly in an external terminal to bypass.\n'
  exit 2
fi

if printf '%s' "$CMD" | grep -qP 'git push.*(--force|-f)\b.*\bmain\b|git push.*\bmain\b.*(--force|-f)\b' 2>/dev/null || \
   printf '%s' "$CMD" | grep -E 'git push.*(--force|--force-with-lease).*main|git push.*main.*(--force|--force-with-lease)' > /dev/null 2>&1; then
  printf '[BLOCKED] Force push to main is not allowed.\n'
  printf 'Rebase the feature branch onto main and merge via PR instead.\n'
  exit 2
fi

FALLOW_PIN='2.95.0'
FALLOW_PIN_RE=$(printf '%s' "$FALLOW_PIN" | sed 's/\./\\./g')
FALLOW_CMD=$(printf '%s ' "$CMD" | tr '\n\t' '  ')
if printf '%s' "$FALLOW_CMD" | grep -qE '(^|[[:space:]&|;/])fallow[[:space:]@]'; then
  if printf '%s' "$FALLOW_CMD" | grep -qE '[;|&`<>]|\$\('; then
    printf '[BLOCKED] Run fallow bare — no chaining/substitution/redirection (; | & ` $() < >).\n'
    printf 'Read its output directly: npx fallow@%s audit\n' "$FALLOW_PIN"
    exit 2
  fi
  if printf '%s' "$FALLOW_CMD" | grep -qE '(^|[[:space:]])FALLOW_[A-Z0-9_]+=' \
     || printf '%s' "$FALLOW_CMD" | grep -qE -- '(^|[[:space:]])(-c|--config|--fallowrc)([[:space:]=])'; then
    printf '[BLOCKED] fallow env (FALLOW_*) or config-file flag — exfil + untrusted-config surface.\n'
    exit 2
  fi
  if printf '%s' "$FALLOW_CMD" | grep -qE -- '--fix|--upload|--cloud|--runtime|--remote|--comment|--review|--write|--apply|--save-|--sarif-file|--ci[[:space:]=]|--format[[:space:]=](review-github|pr-comment-github|review-gitlab|pr-comment-gitlab)[^[:alnum:]-]|[[:space:]=](review-github|pr-comment-github|review-gitlab|pr-comment-gitlab)[^[:alnum:]-]'; then
    printf '[BLOCKED] fallow write/cloud/CI/GitHub+GitLab-posting flag detected (e.g. --sarif-file, --save-*, --ci, --format review-github) — read-only audit only.\n'
    exit 2
  fi
  if ! printf '%s' "$FALLOW_CMD" | grep -qE "^[[:space:]]*npx[[:space:]]+(--yes[[:space:]]+|-y[[:space:]]+)?fallow@${FALLOW_PIN_RE}[[:space:]]+(audit|dead-code|dupes|health|flags|list|workspaces|explain|config|schema)[[:space:]]"; then
    printf '[BLOCKED] fallow must be exactly: npx fallow@%s <read-only subcommand>\n' "$FALLOW_PIN"
    printf 'Allowed: audit dead-code dupes health flags list workspaces explain config schema.\n'
    printf 'Rejected: unpinned/global fallow, other versions, pnpm dlx/bunx/yarn dlx, write subcommands.\n'
    exit 2
  fi
fi

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

if printf '%s' "$CMD" | grep -qE 'gh pr create'; then
  printf '[WARN] Before gh pr create, verify:\n'
  printf '  1. pnpm ready-for-pr passed (ci:local + pr-size + gates:runtime)\n'
  printf '  2. pr-review-toolkit:review-pr ran — Critical/Important findings addressed\n'
  printf '  3. PR body written FROM the template (cat .github/pull_request_template.md first)\n'
  printf 'MANDATORY after creation: pnpm validate-pr-body <pr-number>\n'
  printf 'Do not request reviewer until validate-pr-body exits 0.\n'
fi

exit 0
