#!/usr/bin/env bash

INPUT=$(cat)

# Primary block detection: shlex-tokenized and command-position aware. Matching on
# tokens (not raw substrings) resists the quote / whitespace / chaining evasions a
# grep misses -- gh "pr" merge, git push --"force" origin main, cd x && npm i,
# git add "-A" -- AND it will not false-positive on a dangerous string that appears
# only inside a quoted argument such as a commit message body. See docs/harness-audit.md
# findings 13-17. Exit 2 = block (message on stdout), 0 = analyzed-and-clean,
# 3 = could not analyze (python3 missing / unbalanced quotes) -> coarse fallback below.
DET=$(printf '%s' "$INPUT" | python3 -c "
import json, sys, shlex
raw = sys.stdin.read()
try:
    d = json.loads(raw)
    cmd = d.get('tool_input', {}).get('command', '') or d.get('command', '')
except Exception:
    cmd = ''
if not cmd or not cmd.strip():
    sys.exit(3 if raw.strip() else 0)
try:
    toks = shlex.split(cmd, posix=True)
except ValueError:
    sys.exit(3)
OPS = {'&&', '||', '|', '|&', '&', ';', '\n'}
segs, cur = [], []
for t in toks:
    if t in OPS:
        if cur:
            segs.append(cur); cur = []
    else:
        cur.append(t)
if cur:
    segs.append(cur)
GA = {'-A', '--all', '.'}
FF = {'--force', '-f', '--force-with-lease'}
def block(m):
    sys.stdout.write(m + '\n'); sys.exit(2)
for s in segs:
    if not s:
        continue
    if len(s) >= 2 and s[0] == 'git' and s[1] == 'add' and any(a in GA for a in s[2:]):
        block('[BLOCKED] Broad git add detected.\nCLAUDE.md: use git add -u or git add <specific files> only.\ngit add . / -A / --all stages unintended files (screenshots, worktree artifacts).')
    if s[0] in ('npm', 'yarn'):
        block('[BLOCKED] npm/yarn detected. This project uses pnpm only.\nUse instead: pnpm ' + ' '.join(s[1:]))
    if len(s) >= 3 and s[0] == 'gh' and s[1] == 'pr' and s[2] == 'merge':
        block('[BLOCKED] gh pr merge called directly.\nAI agents must run: pnpm ready-to-merge [pr-number]\nThe repo owner may run gh pr merge directly in an external terminal to bypass.')
    if s[0] == 'git' and 'push' in s and any(f in s for f in FF) and any('main' in t for t in s):
        block('[BLOCKED] Force push to main is not allowed.\nRebase the feature branch onto main and merge via PR instead.')
sys.exit(0)
" 2>/dev/null)
DRC=$?
if [ "$DRC" -eq 2 ]; then
  printf '%s\n' "$DET"
  exit 2
fi

# Command string for the fallow + warn checks (and the coarse fallback path).
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  d = json.load(sys.stdin)
  print(d.get('tool_input', {}).get('command', '') or d.get('command', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")
if [ -z "$CMD" ] && [ -n "$INPUT" ]; then
  CMD="$INPUT"
fi

# Coarse fail-closed fallback for the four core blocks -- ONLY when the tokenized
# detector could not run (DRC != 0/2: python3 missing or unparseable). In the normal
# path (DRC==0) the detector already cleared the command, so these coarse substring
# greps are skipped to avoid over-blocking a quoted argument.
if [ "$DRC" -ne 0 ]; then
  if printf '%s' "$CMD" | grep -qE 'git\s+add\s+(-A\b|--all\b|\.\s*$|\.\s+)'; then
    printf '[BLOCKED] Broad git add detected (coarse fallback; python3 unavailable).\n'
    exit 2
  fi
  if printf '%s' "$CMD" | grep -qE '(^|[;&|]\s*)(npm|yarn)\s+'; then
    printf '[BLOCKED] npm/yarn detected. This project uses pnpm only.\n'
    exit 2
  fi
  if printf '%s' "$CMD" | grep -qE 'gh pr merge'; then
    printf '[BLOCKED] gh pr merge called directly. Run: pnpm ready-to-merge [pr-number].\n'
    exit 2
  fi
  if printf '%s' "$CMD" | grep -qE 'git push.*(--force|--force-with-lease|-f)( |$).*main|git push.*main.*(--force|--force-with-lease|-f)( |$)' 2>/dev/null; then
    printf '[BLOCKED] Force push to main is not allowed.\n'
    exit 2
  fi
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
