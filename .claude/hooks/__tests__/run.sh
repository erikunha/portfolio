#!/usr/bin/env bash
set -u
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
HOOKS="$REPO_ROOT/.claude/hooks"
FAILED=0

FIXDIR=$(mktemp -d)
trap 'rm -rf "$FIXDIR"' EXIT

fail() { printf 'FAIL: %s\n' "$1"; FAILED=1; }
pass() { printf 'ok: %s\n' "$1"; }
assert_eq() { # name expected actual
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected [$2] got [$3])"; fi
}
assert_contains() { # name haystack needle
  case "$2" in *"$3"*) pass "$1";; *) fail "$1 (missing [$3])";; esac
}
assert_not_contains() { # name haystack needle
  case "$2" in *"$3"*) fail "$1 (unexpectedly found [$3])";; *) pass "$1";; esac
}

# Every hook invocation is bounded, and the bound kills the process GROUP.
# alarm alone kills only the exec'd shell: a grandchild holds the pipe's write
# end open, so a $( ) capture blocks past the bound — measured 300s against a
# 3s bound. timeout(1) is absent on darwin, hence perl. Exit 142 on expiry
# matches no assertion, so a wedge fails the suite instead of hanging it.
# The self-check at the end of this file is what holds this claim.
# An adversarial fixture that makes a guard non-terminating must FAIL the suite,
# not wedge it — and measuring elapsed time after an unbounded call cannot do
# that, because the call never returns. timeout(1) is absent on darwin, so
# perl's alarm is the portable bound; it exits 142, which matches no assertion.
# The budget-exhaustion fixtures (BG_WIDE, the 150KB input, the 600-pair
# starvation cases) are exactly the ones that hang when their budget is mutated
# away, so leaving any driver unbounded defeats the point.
HOOK_TIMEOUT_S=20
_run_bounded() {
  perl -e 'my $t = shift; my $p = fork(); die "fork: $!" unless defined $p;
    if ($p == 0) { setpgrp(0, 0); exec @ARGV; exit 127 }
    setpgrp($p, $p);
    $SIG{ALRM} = sub { kill("KILL", -$p) or kill("KILL", $p); waitpid($p, 0); exit 142 };
    alarm $t; waitpid($p, 0); alarm 0;
    exit($? & 127 ? 128 + ($? & 127) : $? >> 8);' "$HOOK_TIMEOUT_S" "$@"
}
run_hook() { _run_bounded bash "$@"; }
run_py() { _run_bounded python3 "$@"; }

cat > "$FIXDIR/messy.ts" <<'EOF'
export const greet=(name:string)=>{
return  `hi ${name}`
}
EOF
cat > "$FIXDIR/unordered-imports.ts" <<'EOF'
import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";

export function handler(_req: NextRequest) {
  const schema = z.object({ ok: z.boolean() });
  return NextResponse.json(schema.parse({ ok: true }));
}
EOF
cat > "$FIXDIR/unused-import.ts" <<'EOF'
import { readFileSync } from "node:fs";

export const ANSWER = 42;
EOF
cat > "$FIXDIR/clean.ts" <<'EOF'
export const ANSWER = 42;
EOF

BIOME_HOOK="$HOOKS/biome-format.sh"
run_format() { # fixture-basename -> echoes the temp file path after the hook ran
  local tmp; tmp=$(mktemp "$FIXDIR/bf.XXXXXX").ts
  cp "$FIXDIR/$1" "$tmp"
  printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | run_hook "$BIOME_HOOK" >/dev/null 2>&1
  printf '%s' "$tmp"
}

t=$(run_format messy.ts)
before=$(cat "$FIXDIR/messy.ts"); after=$(cat "$t")
if [ "$before" != "$after" ]; then pass "format: messy reformatted"; else fail "format: messy unchanged"; fi
"$REPO_ROOT/node_modules/.bin/biome" check --write --linter-enabled=false --no-errors-on-unmatched "$t" >/dev/null 2>&1
assert_eq "format: messy now idempotent" "$after" "$(cat "$t")"
rm -f "$t"

before_first=$(grep -E '^import ' "$FIXDIR/unordered-imports.ts" | head -1)
t=$(run_format unordered-imports.ts)
after=$(cat "$t")
after_first=$(grep -E '^import ' "$t" | head -1)
assert_contains "format: fixture starts with zod (pre-organize)" "$before_first" "from \"zod\""
assert_contains "format: first import is now next/server (reordered)" "$after_first" "from 'next/server'"
assert_not_contains "format: zod no longer leads (reordered)" "$after_first" "from 'zod'"
assert_contains "format: zod import retained" "$after" "from 'zod'"
rm -f "$t"

t=$(run_format unused-import.ts)
assert_contains "format: unused import retained (linter off)" "$(cat "$t")" "readFileSync"
rm -f "$t"

t=$(run_format clean.ts)
assert_eq "format: clean is idempotent" "$(cat "$FIXDIR/clean.ts")" "$(cat "$t")"
rm -f "$t"

tmd=$(mktemp "$FIXDIR/bf.XXXXXX").md
printf '# Title\n\n  badly   spaced markdown\n' > "$tmd"
mdbefore=$(cat "$tmd")
printf '{"tool_input":{"file_path":"%s"}}' "$tmd" | run_hook "$BIOME_HOOK" >/dev/null 2>&1
assert_eq "format: .md skipped (no write)" "$mdbefore" "$(cat "$tmd")"
rm -f "$tmd"

SC_HOOK="$HOOKS/session-context.sh"

out=$(cd "$REPO_ROOT" && printf '' | run_hook "$SC_HOOK")
assert_contains "ctx: hookEventName envelope" "$out" '"hookEventName":"SessionStart"'
assert_contains "ctx: hookSpecificOutput key" "$out" '"hookSpecificOutput"'
assert_contains "ctx: additionalContext key"  "$out" '"additionalContext"'
assert_contains "ctx: marker line"            "$out" '[session-context]'
assert_contains "ctx: branch field"           "$out" 'branch:'
assert_contains "ctx: uncommitted field"      "$out" 'uncommitted:'
UNCOMMITTED_LINE=$(printf '%s' "$out" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['hookSpecificOutput']['additionalContext'])" 2>/dev/null \
  | grep '^uncommitted:')
if printf '%s' "$UNCOMMITTED_LINE" | grep -Eq '^uncommitted: [0-9]+ files$'; then
  pass "ctx: uncommitted is single-line integer"
else
  fail "ctx: uncommitted is single-line integer (got [$UNCOMMITTED_LINE])"
fi
if printf '%s' "$out" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  pass "ctx: valid JSON"
else
  fail "ctx: not valid JSON"
fi

SHIM=$(mktemp -d)
cat > "$SHIM/gh" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
chmod +x "$SHIM/gh"
out_fb=$(cd "$REPO_ROOT" && printf '' | PATH="$SHIM:$PATH" run_hook "$SC_HOOK")
assert_contains "ctx-fallback: still emits envelope" "$out_fb" '"hookEventName":"SessionStart"'
assert_contains "ctx-fallback: branch retained"      "$out_fb" 'branch:'
assert_not_contains "ctx-fallback: CI line omitted"  "$out_fb" 'last CI:'
rm -rf "$SHIM"

NOREPO=$(mktemp -d)
out_nr=$(cd "$NOREPO" && printf '' | run_hook "$SC_HOOK")
assert_eq "ctx: empty outside repo" "" "$out_nr"
rm -rf "$NOREPO"

WIRING=$(python3 -c "
import json
s = json.load(open('$REPO_ROOT/.claude/settings.json'))
post = s.get('hooks', {}).get('PostToolUse', [])
ss   = s.get('hooks', {}).get('SessionStart', [])
post_cmds = [h.get('command','') for blk in post for h in blk.get('hooks', [])]
ss_cmds   = [h.get('command','') for blk in ss   for h in blk.get('hooks', [])]
print('BIOME', any('biome-format.sh' in c for c in post_cmds))
print('SESSION', any('session-context.sh' in c for c in ss_cmds))
" 2>/dev/null)
assert_contains "wiring: biome-format in PostToolUse" "$WIRING" "BIOME True"
assert_contains "wiring: session-context in SessionStart" "$WIRING" "SESSION True"

tmp=$(mktemp "$FIXDIR/bf.XXXXXX").ts; cp "$FIXDIR/messy.ts" "$tmp"; before=$(cat "$tmp")
( cd "$(mktemp -d)" && printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | run_hook "$HOOKS/biome-format.sh" ) >/dev/null 2>&1
ec=$?
assert_eq "guard: biome-missing exit 0" "0" "$ec"
assert_eq "guard: biome-missing file untouched" "$before" "$(cat "$tmp")"
rm -f "$tmp"

gone="$FIXDIR/bf-gone-$$.ts"
printf '{"tool_input":{"file_path":"%s"}}' "$gone" | run_hook "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: missing-file exit 0" "0" "$?"

printf 'not json at all' | run_hook "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: biome malformed-stdin exit 0" "0" "$?"
printf 'not json at all' | run_hook "$HOOKS/session-context.sh" >/dev/null 2>&1
assert_eq "guard: session malformed-stdin exit 0" "0" "$?"

( cd "$REPO_ROOT" && printf '' | run_hook "$HOOKS/session-context.sh" ) >/dev/null 2>&1
assert_eq "guard: session-context exit 0" "0" "$?"

# --- bash-guard.sh block logic (the broadest blocking hook; previously untested) ---
BG_HOOK="$HOOKS/bash-guard.sh"
bg_exit() { # $1=command string -> exit code of bash-guard for a REAL PreToolUse payload
  # The real Claude Code payload nests the command under tool_input — a flat
  # {"command": ...} fixture would match a buggy top-level extraction and give
  # false-green coverage. Use the wrapped shape so the parse-success path is
  # actually exercised (and anchored patterns like ^npm and 'git add .$' are hit).
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command": sys.argv[1]}}))' "$1" | run_hook "$BG_HOOK" >/dev/null 2>&1
  echo $?
}
bg_exit_flat() { # $1=command -> exit for a top-level {"command":...} payload (the fallback branch)
  python3 -c 'import json,sys; print(json.dumps({"command": sys.argv[1]}))' "$1" | run_hook "$BG_HOOK" >/dev/null 2>&1
  echo $?
}
assert_eq "bg: broad 'git add -A' blocked"  "2" "$(bg_exit 'git add -A')"
assert_eq "bg: bare 'git add .' blocked"    "2" "$(bg_exit 'git add .')"
assert_eq "bg: npm blocked"                 "2" "$(bg_exit 'npm install foo')"
assert_eq "bg: yarn blocked"                "2" "$(bg_exit 'yarn add foo')"
assert_eq "bg: 'gh pr merge' blocked"       "2" "$(bg_exit 'gh pr merge 42 --squash')"
assert_eq "bg: force-push main blocked"     "2" "$(bg_exit 'git push --force origin main')"
assert_eq "bg: safe 'git status' allowed"   "0" "$(bg_exit 'git status')"
assert_eq "bg: 'git add -u' allowed"        "0" "$(bg_exit 'git add -u')"
# the top-level-command fallback branch (d.get('command')) must also block
assert_eq "bg: top-level-command fallback blocks npm" "2" "$(bg_exit_flat 'npm install foo')"
# fail-closed: a malformed (non-JSON) payload carrying a dangerous command must STILL block
printf 'gh pr merge 42' | run_hook "$BG_HOOK" >/dev/null 2>&1
assert_eq "bg: fail-closed on malformed payload (gh pr merge)" "2" "$?"
printf 'git push --force origin main' | run_hook "$BG_HOOK" >/dev/null 2>&1
assert_eq "bg: fail-closed on malformed payload (force-push main)" "2" "$?"
# a malformed but safe payload must NOT block (no over-blocking of ordinary commands)
printf 'just some prose with no dangerous command' | run_hook "$BG_HOOK" >/dev/null 2>&1
assert_eq "bg: malformed safe payload allowed" "0" "$?"
# tokenization: quote/whitespace/chaining evasions must NOT bypass the block (findings 14-17)
assert_eq "bg: quoted 'gh \"pr\" merge' blocked"   "2" "$(bg_exit 'gh "pr" merge 42 --squash')"
assert_eq "bg: double-space 'gh pr  merge' blocked" "2" "$(bg_exit 'gh pr  merge 42')"
assert_eq "bg: quoted force-flag to main blocked"  "2" "$(bg_exit 'git push --"force" origin main')"
assert_eq "bg: chained '&& npm' blocked"           "2" "$(bg_exit 'cd repo && npm install foo')"
assert_eq "bg: chained '; yarn' blocked"           "2" "$(bg_exit 'echo hi ; yarn add foo')"
assert_eq "bg: quoted 'git add \"-A\"' blocked"    "2" "$(bg_exit 'git add "-A"')"
assert_eq "bg: quoted 'git add \".\"' blocked"     "2" "$(bg_exit 'git add "."')"
# no-space operator chaining (shlex whitespace-split misses these without punctuation_chars)
assert_eq "bg: no-space '&&npm' blocked"           "2" "$(bg_exit 'cd repo&&npm install foo')"
assert_eq "bg: no-space ';yarn' blocked"           "2" "$(bg_exit 'git status;yarn add foo')"
assert_eq "bg: no-space '&&force main' blocked"    "2" "$(bg_exit 'echo hi&&git push --force origin main')"
assert_eq "bg: no-space '&&gh pr merge' blocked"   "2" "$(bg_exit 'echo hi&&gh pr merge 1')"
# embedded-newline second command (shlex eats \n as whitespace)
assert_eq "bg: newline npm blocked"                "2" "$(bg_exit "$(printf 'git status\nnpm install foo')")"
assert_eq "bg: newline force-main blocked"         "2" "$(bg_exit "$(printf 'echo hi\ngit push --force origin main')")"
# command-position wrappers (env/command/sudo/VAR=val) displace token 0
assert_eq "bg: 'command npm' blocked"              "2" "$(bg_exit 'command npm install foo')"
assert_eq "bg: 'env npm' blocked"                  "2" "$(bg_exit 'env npm install foo')"
assert_eq "bg: 'sudo npm' blocked"                 "2" "$(bg_exit 'sudo npm install foo')"
assert_eq "bg: 'env git force main' blocked"       "2" "$(bg_exit 'env git push --force origin main')"
assert_eq "bg: 'FOO=bar npm' blocked"              "2" "$(bg_exit 'FOO=bar npm install foo')"
# git add pathspec magic that stages the repo root
assert_eq "bg: 'git add :/' blocked"               "2" "$(bg_exit 'git add :/')"
assert_eq "bg: 'git add *' blocked"                "2" "$(bg_exit 'git add "*"')"
# subshell inner command is still checked
assert_eq "bg: subshell '\$(npm ...)' blocked"     "2" "$(bg_exit 'echo $(npm install foo)')"
# a safely-chained pnpm command must NOT block
assert_eq "bg: chained 'cd x && pnpm i' allowed"   "0" "$(bg_exit 'cd repo && pnpm install')"
# a multi-line commit message whose BODY mentions guarded commands must NOT block
# (newlines inside the quoted -m argument must not be treated as command separators)
assert_eq "bg: multi-line commit body allowed" "0" "$(bg_exit "$(printf 'git commit -m "fix: guard\n\n- body mentions npm install and git add -A\n- and gh pr merge"')")"
# bashlex-parsed classes a token heuristic could not reach (command substitution,
# compound commands, redirections, wrapper option-args, refspecs) must block
assert_eq "bg: backtick subst npm blocked"     "2" "$(bg_exit 'echo `npm install foo`')"
assert_eq "bg: dollar-subst npm blocked"       "2" "$(bg_exit 'echo $(npm install foo)')"
assert_eq "bg: brace-group npm blocked"        "2" "$(bg_exit '{ npm install foo; }')"
assert_eq "bg: if-then npm blocked"            "2" "$(bg_exit 'if npm install foo; then :; fi')"
assert_eq "bg: while npm blocked"              "2" "$(bg_exit 'while npm install foo; do :; done')"
assert_eq "bg: env -u X npm blocked"           "2" "$(bg_exit 'env -u X npm install foo')"
assert_eq "bg: sudo -u root npm blocked"       "2" "$(bg_exit 'sudo -u root npm install foo')"
assert_eq "bg: redirect-first npm blocked"     "2" "$(bg_exit '>/tmp/x npm install foo')"
assert_eq "bg: git add bundled -Av blocked"    "2" "$(bg_exit 'git add -Av')"
assert_eq "bg: git add pathspec-file blocked"  "2" "$(bg_exit 'git add --pathspec-from-file=p.txt')"
assert_eq "bg: +main refspec force blocked"    "2" "$(bg_exit 'git push origin +main')"
assert_eq "bg: force-with-lease main blocked"  "2" "$(bg_exit 'git push --force-with-lease origin main')"
# the parser distinguishes command from argument, so these must NOT block (no over-block)
assert_eq "bg: 'grep npm' allowed"             "0" "$(bg_exit 'grep npm file.txt')"
assert_eq "bg: 'cat npm-debug.log' allowed"    "0" "$(bg_exit 'cat npm-debug.log')"
assert_eq "bg: 'git log --grep npm' allowed"   "0" "$(bg_exit 'git log --grep npm')"
assert_eq "bg: push to maintain-branch allowed" "0" "$(bg_exit 'git push origin chore/maintain-docs')"
# interpreter-with-literal-string: re-parse the -c/eval script so the inner command is caught
assert_eq "bg: eval npm blocked"               "2" "$(bg_exit 'eval "npm i"')"
assert_eq "bg: bash -c npm blocked"            "2" "$(bg_exit 'bash -c "npm install"')"
assert_eq "bg: sh -c git-add blocked"          "2" "$(bg_exit 'sh -c "git add -A"')"
assert_eq "bg: env bash -c npm blocked"        "2" "$(bg_exit 'env bash -c "npm i"')"
assert_eq "bg: python os.system npm blocked"   "2" "$(bg_exit 'python3 -c "import os; os.system(\"npm i\")"')"
assert_eq "bg: bash script file allowed"       "0" "$(bg_exit 'bash deploy.sh')"
assert_eq "bg: bash -c echo allowed"           "0" "$(bg_exit 'bash -c "echo hi"')"
# git/gh global flags before the subcommand must not displace the check
assert_eq "bg: 'git -C . add -A' blocked"      "2" "$(bg_exit 'git -C . add -A')"
assert_eq "bg: 'git --no-pager add -A' blocked" "2" "$(bg_exit 'git --no-pager add -A')"
assert_eq "bg: 'gh --repo x pr merge' blocked" "2" "$(bg_exit 'gh --repo owner/repo pr merge 42')"
assert_eq "bg: 'git -C . status' allowed"      "0" "$(bg_exit 'git -C . status')"
# force-flag variants: =form and bundled short flags
assert_eq "bg: --force-with-lease= main blocked" "2" "$(bg_exit 'git push --force-with-lease=origin/main origin')"
assert_eq "bg: bundled -fu main blocked"       "2" "$(bg_exit 'git push -fu origin main')"
# runtime-expansion forms a parser must expand: brace expansion, find -exec, here-string
assert_eq "bg: brace {npm,i} blocked"          "2" "$(bg_exit '{npm,i}')"
assert_eq "bg: git add brace {.,x} blocked"    "2" "$(bg_exit 'git add {.,x}')"
assert_eq "bg: find -exec npm blocked"         "2" "$(bg_exit 'find . -exec npm i \;')"
assert_eq "bg: here-string sh npm blocked"     "2" "$(bg_exit "sh <<< 'npm i'")"
# the here-string branch must resolve the interpreter by basename + strip wrappers,
# exactly as inspect() does -- else a path-prefixed or wrapped shell re-opens the bypass
assert_eq "bg: here-string /bin/sh npm blocked" "2" "$(bg_exit "/bin/sh <<< 'npm i'")"
assert_eq "bg: here-string sudo bash npm blkd"  "2" "$(bg_exit "sudo /usr/bin/bash <<< 'npm i'")"
assert_eq "bg: here-string FOO=1 sh npm blocked" "2" "$(bg_exit "FOO=1 sh <<< 'npm i'")"
assert_eq "bg: here-string sh echo allowed"     "0" "$(bg_exit "sh <<< 'echo hi'")"
assert_eq "bg: here-string cat npm-word allowed" "0" "$(bg_exit "cat <<< 'npm is a word'")"
assert_eq "bg: backslash \\npm blocked"        "2" "$(bg_exit '\npm i')"
assert_eq "bg: legit brace mkdir allowed"      "0" "$(bg_exit 'mkdir -p src/{a,b}')"
assert_eq "bg: legit find -name allowed"       "0" "$(bg_exit 'find . -name npm-debug.log')"
# oversized input skips the parser (size cap) and falls to the coarse fallback fast
BG_BIG="echo $(head -c 150000 /dev/zero | tr '\0' x)"
assert_eq "bg: oversized input -> no parse-hang" "0" "$(bg_exit "$BG_BIG")"
# many sibling interpreter invocations exhaust the shared reparse budget -> NEST block
BG_WIDE="$(python3 -c "print(';'.join([\"bash -c 'true'\"]*500))")"
assert_eq "bg: reparse-budget exhaustion blocks" "2" "$(bg_exit "$BG_WIDE")"
# absolute/relative path to the binary must match on basename
assert_eq "bg: '/usr/bin/npm' blocked"         "2" "$(bg_exit '/usr/bin/npm install')"
assert_eq "bg: abs-path 'git add .' blocked"   "2" "$(bg_exit '/usr/bin/git add .')"
assert_eq "bg: 'sudo /usr/bin/npm' blocked"    "2" "$(bg_exit 'sudo /usr/bin/npm install')"
assert_eq "bg: './node_modules/.bin/npm' blk"  "2" "$(bg_exit './node_modules/.bin/npm install')"
assert_eq "bg: '/usr/bin/echo' allowed"        "0" "$(bg_exit '/usr/bin/echo hi')"
# bundled short flag before an attached interpreter script (python3 -Bc'...')
assert_eq "bg: 'python3 -Bc npm' blocked"      "2" "$(bg_exit 'python3 -Bc'\''import os; os.system("npm i")'\''')"
# bundled interpreter flag (bash -lc), git 'stage' alias, yarnpkg binary, and a
# padded-brace filler that must not strand the real dangerous argument
assert_eq "bg: 'bash -lc npm' blocked"         "2" "$(bg_exit 'bash -lc "npm i"')"
assert_eq "bg: 'sudo bash -ic npm' blocked"    "2" "$(bg_exit 'sudo bash -ic "npm i"')"
assert_eq "bg: 'git stage -A' blocked"         "2" "$(bg_exit 'git stage -A')"
assert_eq "bg: 'git stage .' blocked"          "2" "$(bg_exit 'git stage .')"
assert_eq "bg: 'yarnpkg install' blocked"      "2" "$(bg_exit 'yarnpkg install')"
assert_eq "bg: 'bash -lc echo' allowed"        "0" "$(bg_exit 'bash -lc "echo hi"')"
BG_FILLER="git add {$(python3 -c "print(','.join('x%d'%i for i in range(80)))")} ."
assert_eq "bg: filler-brace before '.' blocked" "2" "$(bg_exit "$BG_FILLER")"
# non-terminal -c in a bundled cluster (bash -cx) still takes the next word as script
assert_eq "bg: 'bash -cx npm' blocked"         "2" "$(bg_exit 'bash -cx "npm i"')"
assert_eq "bg: 'sh -cx git-add' blocked"       "2" "$(bg_exit 'sh -cx "git add -A"')"
# attached interpreter flags (no space) for python/ruby, and php -r
assert_eq "bg: python -c'...' attached blocked" "2" "$(bg_exit 'python3 -c'\''import os; os.system("npm i")'\''')"
assert_eq "bg: php -r blocked"                 "2" "$(bg_exit 'php -r '\''system("npm i");'\''')"
# git add trailing-slash form
assert_eq "bg: 'git add ./' blocked"           "2" "$(bg_exit 'git add ./')"
assert_eq "bg: 'git stage ./' blocked"         "2" "$(bg_exit 'git stage ./')"
assert_eq "bg: 'git add src/' allowed"         "0" "$(bg_exit 'git add src/')"
assert_eq "bg: 'git stash' allowed"            "0" "$(bg_exit 'git stash')"
# command-position: a dangerous string only inside a quoted arg (commit message) must NOT block (finding 13)
assert_eq "bg: 'gh pr merge' in commit msg allowed"  "0" "$(bg_exit 'git commit -m "docs: explain the gh pr merge guard"')"
assert_eq "bg: 'git add -A' in commit msg allowed"   "0" "$(bg_exit 'git commit -m "chore: forbid git add -A"')"
# specific (non-broad) forms stay allowed
assert_eq "bg: 'git add <paths>' allowed"          "0" "$(bg_exit 'git add src/foo.ts src/bar.ts')"
assert_eq "bg: 'git add .claude/agents/' allowed"  "0" "$(bg_exit 'git add .claude/agents/')"
assert_eq "bg: force-push to non-main allowed"     "0" "$(bg_exit 'git push --force origin feature/x')"

# --- api-edit-marker.sh block logic (isolated in a temp non-git dir; real marker untouched) ---
AEM_HOOK="$HOOKS/api-edit-marker.sh"
aem_marked() { # $1=file_path -> MARKED|NONE (marker written to an isolated temp ROOT)
  local d; d=$(mktemp -d)
  printf '{"tool_input":{"file_path":"%s"}}' "$1" | ( cd "$d" && run_hook "$AEM_HOOK" >/dev/null 2>&1 )
  if [ -s "$d/.claude/.api-edit-pending" ]; then printf 'MARKED'; else printf 'NONE'; fi
  rm -rf "$d"
}
assert_eq "aem: app/api path marked"  "MARKED" "$(aem_marked /repo/app/api/ask/route.ts)"
assert_eq "aem: rate-limit.ts marked" "MARKED" "$(aem_marked /repo/lib/rate-limit.ts)"
assert_eq "aem: proxy.ts marked"      "MARKED" "$(aem_marked /repo/proxy.ts)"
assert_eq "aem: non-API not marked"   "NONE"   "$(aem_marked /repo/components/sections/Hero.tsx)"
# fail-closed: a malformed payload mentioning an API path must STILL record a marker
aem_d=$(mktemp -d)
printf 'garbled non-json app/api/ask/route.ts payload' | ( cd "$aem_d" && run_hook "$AEM_HOOK" >/dev/null 2>&1 )
if [ -s "$aem_d/.claude/.api-edit-pending" ]; then aem_fc=MARKED; else aem_fc=NONE; fi
rm -rf "$aem_d"
assert_eq "aem: fail-closed on malformed payload with API path" "MARKED" "$aem_fc"

# --- architect-gate.sh block logic (writing-plans PreToolUse Skill matcher) ---
AG_HOOK="$HOOKS/architect-gate.sh"
ag_payload() { # $1=skill $2=transcript-path -> JSON PreToolUse payload for the Skill matcher
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Skill","tool_input":{"skill": sys.argv[1]}, "transcript_path": sys.argv[2]}))' "$1" "$2"
}

(cd "$REPO_ROOT" && ag_payload 'speckit-specify' "$FIXDIR/ag-nonexistent-$$.jsonl" | run_hook "$AG_HOOK") >/dev/null 2>&1
assert_eq "ag: non-matching skill allowed" "0" "$?"

AG_T_NONE="$FIXDIR/ag-none-$$.jsonl"
printf '%s\n' '{"message":{"role":"assistant","content":[{"type":"text","text":"no agent dispatch here"}]}}' > "$AG_T_NONE"
out=$(cd "$REPO_ROOT" && ag_payload 'speckit-plan' "$AG_T_NONE" | run_hook "$AG_HOOK" 2>&1)
ec=$?
assert_eq "ag: block when transcript has no architect-reviewer dispatch" "2" "$ec"
assert_contains "ag: block message names the missing PASS" "$out" "no architect-reviewer GATE_RESULT: PASS"
rm -f "$AG_T_NONE"

AG_T_FAIL="$FIXDIR/ag-fail-$$.jsonl"
{
  printf '%s\n' '{"message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_ag_fail","name":"Agent","input":{"subagent_type":"architect-reviewer","prompt":"Review the spec."}}]}}'
  printf '%s\n' '{"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_ag_fail","content":"Spec has gaps.\nGATE_RESULT: FAIL"}]}}'
} > "$AG_T_FAIL"
(cd "$REPO_ROOT" && ag_payload 'speckit-plan' "$AG_T_FAIL" | run_hook "$AG_HOOK") >/dev/null 2>&1
assert_eq "ag: block when architect-reviewer returned GATE_RESULT: FAIL" "2" "$?"
rm -f "$AG_T_FAIL"

AG_T_WRONG_AGENT="$FIXDIR/ag-wrong-agent-$$.jsonl"
{
  printf '%s\n' '{"message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_ag_wrong","name":"Agent","input":{"subagent_type":"code-reviewer","prompt":"Review the code."}}]}}'
  printf '%s\n' '{"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_ag_wrong","content":"Looks fine.\nGATE_RESULT: PASS"}]}}'
} > "$AG_T_WRONG_AGENT"
(cd "$REPO_ROOT" && ag_payload 'speckit-plan' "$AG_T_WRONG_AGENT" | run_hook "$AG_HOOK") >/dev/null 2>&1
assert_eq "ag: block when PASS came from a non-architect-reviewer agent" "2" "$?"
rm -f "$AG_T_WRONG_AGENT"

AG_T_PASS="$FIXDIR/ag-pass-$$.jsonl"
{
  printf '%s\n' '{"message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_ag_pass","name":"Agent","input":{"subagent_type":"architect-reviewer","prompt":"Review the spec against the four-gate protocol."}}]}}'
  printf '%s\n' '{"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_ag_pass","content":"Spec reviewed end to end.\nGATE_RESULT: PASS"}]}}'
} > "$AG_T_PASS"
(cd "$REPO_ROOT" && ag_payload 'speckit-plan' "$AG_T_PASS" | run_hook "$AG_HOOK") >/dev/null 2>&1
assert_eq "ag: allow when architect-reviewer returned GATE_RESULT: PASS" "0" "$?"
rm -f "$AG_T_PASS"

out=$(cd "$REPO_ROOT" && ag_payload 'speckit-plan' "$FIXDIR/ag-missing-$$.jsonl" | run_hook "$AG_HOOK" 2>&1)
ec=$?
assert_eq "ag: fail-closed on unreadable transcript path" "2" "$ec"
assert_contains "ag: fail-closed message cites unreadable transcript" "$out" "transcript unreadable (fail-closed)"

(cd "$REPO_ROOT" && ag_payload 'speckit-plan' '' | run_hook "$AG_HOOK") >/dev/null 2>&1
assert_eq "ag: fail-closed on empty transcript_path" "2" "$?"

(printf 'speckit-plan embedded in unparseable json' | ( cd "$REPO_ROOT" && run_hook "$AG_HOOK" )) >/dev/null 2>&1
assert_eq "ag: malformed payload with writing-plans token fails closed" "2" "$?"

(printf 'just some garbled non-json text with no skill token' | ( cd "$REPO_ROOT" && run_hook "$AG_HOOK" )) >/dev/null 2>&1
assert_eq "ag: malformed payload with no token allowed" "0" "$?"

# --- api-security-push-guard.sh block logic (git push PreToolUse Bash matcher) ---
ASG_HOOK="$HOOKS/api-security-push-guard.sh"
asg_hook() { run_hook "$ASG_HOOK"; }
asg_payload() { # $1=command $2=transcript-path -> JSON PreToolUse payload for the Bash matcher
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command": sys.argv[1]},"transcript_path": sys.argv[2]}))' "$1" "$2"
}
asg_mkroot() { # -> isolated non-git dir seeded with a transcript.mjs copy so the hook's own node parser resolves
  local d; d=$(mktemp -d)
  mkdir -p "$d/scripts/lib" "$d/.claude"
  cp "$REPO_ROOT/scripts/lib/transcript.mjs" "$d/scripts/lib/transcript.mjs"
  printf '%s' "$d"
}

d=$(asg_mkroot)
(asg_payload 'git status' '' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: non-push command allowed" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
(asg_payload 'git push origin main' '' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: push allowed with no marker pending" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
ASG_T_NONE="$FIXDIR/asg-none-$$.jsonl"
printf '%s\n' '{"timestamp":"2020-01-01T00:00:01.000Z","message":{"role":"assistant","content":[{"type":"text","text":"no dispatch"}]}}' > "$ASG_T_NONE"
out=$(asg_payload 'git push origin main' "$ASG_T_NONE" | ( cd "$d" && asg_hook ) 2>&1)
ec=$?
assert_eq "asg: block when marker pending and no security-auditor dispatch" "2" "$ec"
assert_contains "asg: block message cites unaudited edit" "$out" "unaudited API-surface edit"
rm -rf "$d"; rm -f "$ASG_T_NONE"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
ASG_T_STALE="$FIXDIR/asg-stale-$$.jsonl"
printf '%s\n' '{"timestamp":"2019-01-01T00:00:00.000Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_asg_stale","name":"Agent","input":{"subagent_type":"security-auditor","prompt":"stale audit predating the marker"}}]}}' > "$ASG_T_STALE"
(asg_payload 'git push origin main' "$ASG_T_STALE" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: block when security-auditor dispatch predates the marker" "2" "$?"
rm -rf "$d"; rm -f "$ASG_T_STALE"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
ASG_T_PASS="$FIXDIR/asg-pass-$$.jsonl"
printf '%s\n' '{"timestamp":"2020-01-01T00:05:00.000Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_asg_pass","name":"Agent","input":{"subagent_type":"security-auditor","prompt":"Audit the API-surface change."}}]}}' > "$ASG_T_PASS"
(asg_payload 'git push origin main' "$ASG_T_PASS" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: allow when security-auditor dispatched after the marker" "0" "$?"
if [ -e "$d/.claude/.api-edit-pending" ]; then asg_marker_state=EXISTS; else asg_marker_state=CLEARED; fi
assert_eq "asg: marker cleared after a verified audit" "CLEARED" "$asg_marker_state"
rm -rf "$d"; rm -f "$ASG_T_PASS"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
out=$(asg_payload 'git push origin main' "$d/does-not-exist-$$.jsonl" | ( cd "$d" && asg_hook ) 2>&1)
ec=$?
assert_eq "asg: fail-closed on unreadable transcript with marker pending" "2" "$ec"
assert_contains "asg: fail-closed message cites unreadable transcript" "$out" "transcript unreadable (fail-closed)"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload 'git push origin main' '' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: fail-closed on empty transcript_path with marker pending" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf 'garbled not json git push origin main' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: malformed payload with git-push token fails closed" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_name":"Bash","tool_input":{"command":"git push origin main"},"transcript_path":' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: truncated JSON payload with quoted git-push command fails closed" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"cd /r &&\\ngit push origin main"},"transcript' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: escape sequence before the git token fails closed" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{\\"command\\":\\"git push\\"}' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: double-encoded payload with escape after the push token fails closed" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"ls -la"},"transcript' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: malformed payload for an unrelated command stays allowed (no hard-lock)" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf 'garbled not json, nothing relevant here' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: malformed payload with no token allowed" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"git status"},"transcript' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: containment needs BOTH tokens — git alone must not hard-lock" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"npm run push-notes"},"transcript' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: containment needs BOTH tokens — push alone must not hard-lock" "0" "$?"
rm -rf "$d"


d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"rm .claude/.api-edit-pending","description":"clear the marker so git push can proceed"},"transcript' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: a prose description must not lock out the escape it describes" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload 'ls -la' "$d/gitrepos/push-notes/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: benign command is not matched by tokens in transcript_path" "0" "$?"
rm -rf "$d"

PYSHIM=$(mktemp -d)
cat > "$PYSHIM/python3" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
chmod +x "$PYSHIM/python3"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
asg_nopy=$( (asg_payload 'git push origin main' "$d/t.jsonl" | ( cd "$d" && PATH="$PYSHIM:$PATH" asg_hook )) 2>&1 )
asg_nopy_code=$?
assert_eq "asg: push blocks when python3 is unusable" "2" "$asg_nopy_code"
assert_contains "asg: block names the manual clear no dispatch can substitute for" "$asg_nopy" "rm "
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload 'cd repo&&git push origin main' "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: a shell operator is a token boundary, not just whitespace" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload 'git commit -m "add pushups"' "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: widening the boundary must not start matching push inside a word" "0" "$?"
rm -rf "$d"

# every character in the boundary class is load-bearing: one fixture per position,
# because a class is only as good as the character a mutant can delete unnoticed.
for asg_op in 'a;git push' 'a|git push' '(git push)' 'git push;a' 'git push&&a' 'git push|a' 'cd repo && git push origin main'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_op" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: operator boundary pinned for [$asg_op]" "2" "$?"
  rm -rf "$d"
done

# The class a boundary heuristic cannot reach: the token is only `git` after the
# shell dequotes/resolves it, so detection has to happen at command position.
for asg_evade in '/usr/bin/git push origin main' 'bash -c "git push origin main"' "sh -c 'git push'" 'g\it push origin main' '`git push`' '$(git push origin main)' 'git subtree push --prefix=x origin main'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_evade" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: command-position detection blocks [$asg_evade]" "2" "$?"
  rm -rf "$d"
done

# The opposite direction the same tokenizer must fix: `push` appearing as an
# operand of a non-push subcommand is not a push.
for asg_ok in 'git log --grep push' 'git log --oneline | grep push' 'git commit -m "explain the git push guard"' 'git rev-parse HEAD; echo push' 'npm install && git log --grep push' 'git stash push'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: not a push, must not block [$asg_ok]" "0" "$?"
  rm -rf "$d"
done

# A wrapper resolves the program by presence, on a code path that does not call
# inspect(); every one of these blocked before the tokenizer and must still.
for asg_wrap in 'env git push' 'env -i git push origin main' 'env GIT_TRACE=1 git push' 'sudo git push' \
                'sudo -u me git push' 'doas git push' 'command git push' 'xargs git push' \
                'echo main | xargs -I{} git push origin {}' 'timeout 60 git push' 'nice git push' \
                'nohup git push' 'setsid git push' 'stdbuf -o0 git push' 'exec git push' 'builtin git push'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_wrap" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: wrapper-resolved push blocks [$asg_wrap]" "2" "$?"
  rm -rf "$d"
done

for asg_wrap_ok in 'env git status' 'sudo git log --grep push' 'timeout 5 npm run push-notes' 'sudo grep git file'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_wrap_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: wrapper without a push stays allowed [$asg_wrap_ok]" "0" "$?"
  rm -rf "$d"
done

# git's value-taking global flags: the skip list must not mistake a flag's operand
# for the subcommand, and must not let one hide the subcommand behind it.
for asg_flag in 'git -C /tmp push' 'git -c a=b push' 'git --git-dir=x push' 'git --git-dir /x push' 'git --work-tree /t push' \
                'git --exec-path /e push' 'git --namespace n push' 'git --config-env=k=V push' \
                'git --config-env k=V push'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_flag" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: global flag does not hide the subcommand [$asg_flag]" "2" "$?"
  rm -rf "$d"
done

# "walked it, found no push" and "could not see through this" must not be the
# same answer: each of these hides the push behind a construct the walk cannot
# resolve, and each blocked before the tokenizer replaced the coarse regex.
for asg_opaque in '`echo git push origin main`' \
                  'eval "$(echo git push origin main)"' \
                  'echo "git push origin main" | bash' \
                  'bash <(echo "git push origin main")' \
                  'G=git; $G push origin main'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_opaque" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: opaque construct is undecidable, not clean [$asg_opaque]" "2" "$?"
  rm -rf "$d"
done

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload "bash -c \"bash -c 'bash -c \\\"git push origin main\\\"'\"" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: nested bash -c inside MAX_DEPTH still blocks" "2" "$?"
rm -rf "$d"

# An operand the shell has not expanded yet cannot be compared to "push", and a
# git record stripped of its operands is a mis-parse — neither is "not a push".
for asg_unres in 'git $(echo push) origin main' \
                 'git `echo push` origin main' \
                 'P=push; git $P origin main' \
                 'echo push | xargs git'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_unres" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: unresolved subcommand is undecidable [$asg_unres]" "2" "$?"
  rm -rf "$d"
done

for asg_unres_ok in 'git log --grep $PATTERN' 'git commit -m "msg $VAR"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_unres_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an expansion past a settled subcommand is still allowed [$asg_unres_ok]" "0" "$?"
  rm -rf "$d"
done

# Bound exhaustion must report undecidable, not clean: MAX_DEPTH is 6.
d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
asg_deep='git push origin main'
for _ in 1 2 3 4 5 6 7 8; do asg_deep="bash -c \"$asg_deep\""; done
(asg_payload "$asg_deep" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: nesting past MAX_DEPTH is undecidable, not clean" "2" "$?"
rm -rf "$d"

# Inline code in a non-shell interpreter, an unexpanded flag VALUE, a git alias
# configured to push, an xargs replacement string, and a value-taking global flag
# outside the skip list: each hides the push somewhere the first-subcommand rule
# does not look.
for asg_hide in 'python3 -c "import os; os.system(\"git push\")"' \
                'node -e "require(\"child_process\").execSync(\"git push\")"' \
                'git -c $CFG' \
                'git -c alias.z=push z origin main' \
                'echo "git push" | xargs -I PLACE bash -c PLACE' \
                'git --super-prefix x push'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_hide" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a push hidden past the subcommand still blocks [$asg_hide]" "2" "$?"
  rm -rf "$d"
done

for asg_hide_ok in 'git log' 'git status' 'git commit -m x' 'git diff --stat'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_hide_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: widening the hidden-push net must not over-block [$asg_hide_ok]" "0" "$?"
  rm -rf "$d"
done

# git ships dashed hardlinks (git-push) that perform the subcommand directly, and
# exec wrappers outside the shell's own set still exec the real binary.
for asg_alias in '/usr/libexec/git-core/git-push origin main' \
                 'git --config-env=alias.z=Z z origin main' \
                 'git -calias.z=push z origin main' \
                 'git-push origin main' \
                 'script -q /dev/null git push origin main' \
                 'flock /tmp/l git push origin main'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_alias" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a push under another program name still blocks [$asg_alias]" "2" "$?"
  rm -rf "$d"
done

# The guard prints an ABSOLUTE marker path, so a repo path holding both tokens
# must not make containment block the escape the guard itself just recommended.
PYSHIM2=$(mktemp -d)
printf '#!/usr/bin/env bash\nexit 1\n' > "$PYSHIM2/python3"
chmod +x "$PYSHIM2/python3"
d=$(mktemp -d)/github-push-demo
mkdir -p "$d/.claude"
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"rm %s/.claude/.api-edit-pending"},"transcript_path":"/n"}' "$d" \
  | ( cd "$d" && PATH="$PYSHIM2:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: repo-path tokens must not trap the operator's escape" "0" "$?"
(printf '{"tool_input":{"command":"git push origin main"},"transcript_path":"/n"}' \
  | ( cd "$d" && PATH="$PYSHIM2:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: stripping the repo path must not unblock a real push" "2" "$?"
rm -rf "$PYSHIM2"

# A detector that cannot decide must not read as "looked, found no push".
d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload "$(printf 'sh <<EOF\ngit push origin main\nEOF')" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: a heredoc body feeding a shell is not a blind spot" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload "bash -c 'echo ((' ; /usr/bin/git push origin main" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: an unparseable inner payload must not unlock an evasive push" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload "$(python3 -c "print('/usr/bin/git push origin main #'+'x'*100001)")" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: a command past MAX_CMD_LEN must not unlock an evasive push" "2" "$?"
rm -rf "$d"

# The detector must report undecidable, not crash: an inert block() used to fall
# through to an unbound `trees` and exit 1 by traceback.
# The reparse budget is what makes the depth/budget branch reachable: filler
# reparses exhaust it, and the push after them is only seen if exhaustion reports
# undecidable rather than clean.
det_budget=$(python3 -c "print(';'.join([\"bash -c 'true'\"]*401) + \"; bash -c 'git push origin main'\")")
det_budget_rc=$(python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command": sys.argv[1]}}))' "$det_budget" \
  | run_py "$HOOKS/bash-guard-detect.py" --emit-commands >/dev/null 2>&1; echo $?)
assert_eq "det: reparse-budget exhaustion exits 3 (undecidable), not 0" "3" "$det_budget_rc"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload "$det_budget" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: a push after budget exhaustion still blocks" "2" "$?"
rm -rf "$d"

# A config VALUE is only dangerous where it can name an alias; a path value cannot
# turn a subcommand into a push, and blocking it trains bypass.
# core.hooksPath redirection disables .husky/pre-push — the git-level marker check
# that backstops every accepted residual — and git propagates -c to the hook's own
# subprocesses via GIT_CONFIG_PARAMETERS, so the push it spawns skips it too.
for asg_hooks in 'git -c core.hooksPath=/tmp/h commit -m wip' \
                 'git -c core.hooksPath=/tmp/h merge feat' \
                 'git --config-env=core.hooksPath=H rebase main' \
                 'git -ccore.hooksPath=/tmp/h commit -m x'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_hooks" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: disabling the git-level backstop blocks [$asg_hooks]" "2" "$?"
  rm -rf "$d"
done

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload 'git commit -m "document core.hooksPath in the runbook"' "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: naming core.hooksPath in prose is not redirecting it" "0" "$?"
rm -rf "$d"

for asg_cfg_ok in 'git --namespace n status' 'PATH=/x:$PATH make build' 'env FOO=bar git status' 'git config --list'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_cfg_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a non-config flag value must not over-block [$asg_cfg_ok]" "0" "$?"
  rm -rf "$d"
done

# git config carries several keys that execute code (alias.*, core.hooksPath,
# core.sshCommand, credential.helper, include.path pulling in any of them), so
# enumerating the dangerous ones is an open set. While a marker is pending, any
# config injection blocks — including the env-var spelling, which bashlex parses
# as assignment nodes that never reach the command's word list.
# git config the SUBCOMMAND persists into every later command, so the follow-up
# needs no suspicious flag at all; and --git-dir/-C/--work-tree point git at a
# different repo whose .git/config an earlier, separately-innocuous write control.
# The property, stated once: while a marker pends, a git invocation must not gain
# configuration or execution it would not otherwise have. These are the NO-ARTIFACT
# spellings — one Bash call, nothing written to disk, nothing else in the transcript.
for asg_noartifact in 'GIT_SSH_COMMAND="sh -c evil" git fetch origin' \
                      'GIT_EDITOR="sh -c evil" git commit' \
                      'GIT_EXTERNAL_DIFF="sh -c evil" git diff' \
                      'GIT_PAGER="sh -c evil" git log' \
                      'GIT_ASKPASS="sh -c evil" git fetch' \
                      'export GIT_CONFIG_KEY_0=alias.z GIT_CONFIG_VALUE_0=push GIT_CONFIG_COUNT=1' \
                      'git --exec-path=/tmp/evil foo' \
                      'git --super-prefix=/tmp/evil status'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_noartifact" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: no-artifact execution vector blocks [$asg_noartifact]" "2" "$?"
  rm -rf "$d"
done

# The exec flags live AFTER the subcommand, where an arg loop that stops at the
# first non-flag word never looks. Each of these execs a named program against a
# local remote: one Bash call, no file, no network.
for asg_execflag in 'git fetch --upload-pack="sh -c evil" .' \
                    'git ls-remote --upload-pack="sh -c evil" .' \
                    'git pull --upload-pack="sh -c evil" .' \
                    'git clone --upload-pack="sh -c evil" . dst' \
                    'git push --receive-pack="sh -c evil" .' \
                    'git archive --remote=. --exec="sh -c evil" HEAD' \
                    'git difftool --no-index -y --extcmd="sh -c evil" a b' \
                    'git init --template=/tmp/evil-template' \
                    'git clone --separate-git-dir=/tmp/evil . dst'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_execflag" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a post-subcommand exec flag blocks [$asg_execflag]" "2" "$?"
  rm -rf "$d"
done

# A dashed hardlink carries its subcommand in the program name, so no argument
# scan can screen it. Under a wrapper the basename is the wrapper's, not git's.
for asg_hardlink in 'sudo git-push origin main' \
                    'env git-push origin main' \
                    'nice git-push origin main' \
                    'timeout 5 git-push origin main' \
                    'git-config core.hooksPath /tmp/h'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_hardlink" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a dashed git hardlink blocks [$asg_hardlink]" "2" "$?"
  rm -rf "$d"
done

# WRAPPERS entries that shipped without a case of their own.
for asg_wrapper in 'ionice -c3 git push' 'chrt -b 0 git push' 'watch git push' 'parallel git push' \
                   'script -q /dev/null git push' 'flock /tmp/l git push'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_wrapper" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a wrapped push blocks under every WRAPPERS entry [$asg_wrapper]" "2" "$?"
  rm -rf "$d"
done

# --unset removes core.hooksPath, which disables husky exactly as redirection does.
# Counting operands scores it as a read; it is a write.
for asg_cfgwrite in 'git config --unset core.hooksPath' \
                    'git config --unset-all core.hooksPath' \
                    'git config --remove-section core' \
                    'git config --replace-all alias.z push' \
                    'git config --add alias.z push'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_cfgwrite" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a config write blocks whatever its spelling [$asg_cfgwrite]" "2" "$?"
  rm -rf "$d"
done

# bash expands the NAME before export reads name=value, so the static token text
# never starts with GIT_. Opacity is the answer, the same as in git's own args.
for asg_indirect in 'export $A=1 $B=alias.z $C=push' \
                    'declare $VAR=core.hooksPath' \
                    'export $(printf GIT_CONFIG_COUNT)=1'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_indirect" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an opaque assignment name is undecidable, not clean [$asg_indirect]" "2" "$?"
  rm -rf "$d"
done

# source/. reads a script the walk never sees; that is undecidable, not clean.
for asg_source in 'source <(printf "git push\n")' '. <(printf "git push\n")'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_source" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a sourced script is undecidable, not clean [$asg_source]" "2" "$?"
  rm -rf "$d"
done

# git funnels the editor through `sh -c`, and EDITOR/VISUAL are the fallbacks it
# consults when GIT_EDITOR is unset — a GIT_-prefix screen is the same
# enumeration mistake one namespace over.
for asg_execenv in 'EDITOR="git push origin main #" git commit --amend' \
                   'VISUAL="sh -c evil" git commit' \
                   'SSH_ASKPASS="sh -c evil" git fetch' \
                   'BASH_ENV="/tmp/evil" bash -c :' \
                   'export EDITOR="sh -c evil"' \
                   'env EDITOR="sh -c evil" git commit'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_execenv" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an execution-honoring env name blocks, GIT_ prefix or not [$asg_execenv]" "2" "$?"
  rm -rf "$d"
done

# trap defers a shell string the walk must read, not record as an inert word.
for asg_trap in 'trap "git push origin main" DEBUG' \
                'trap "git push" EXIT' \
                'trap "git fetch --upload-pack=x ." ERR'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_trap" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a trap body is reparsed, not recorded inert [$asg_trap]" "2" "$?"
  rm -rf "$d"
done

# The detector reporting exit 3 means it could not read the command. Re-screening
# that with a fixed-string grep is defeated by concatenation, which is why the
# undecidable verdict now blocks instead of falling through to containment.
for asg_undecidable in 'python3 -c "import os;os.system('"'"'gi'"'"'+'"'"'t push origin main'"'"')"' \
                       'eval "$(printf '"'"'gi%st push'"'"' t)"' \
                       'node -e "require(\"child_process\").exec(\"gi\"+\"t push\")"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_undecidable" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an unreadable command is undecidable, never clean [$asg_undecidable]" "2" "$?"
  rm -rf "$d"
done

# Exit 3 (the walk read the command and could not decide) and "there is no walk"
# are different verdicts. Conflating them made a missing vendor/bashlex block
# EVERY command, including the documented rm-the-marker escape, which turns a
# broken checkout into a session nothing can recover.
asg_noparser() {
  local d hookcopy rc
  d=$(asg_mkroot)
  mkdir -p "$d/hooks"
  cp "$HOOKS/api-security-push-guard.sh" "$d/hooks/"
  cp "$HOOKS/bash-guard-detect.py" "$d/hooks/"
  # deliberately no vendor/ — bash-guard-detect.py cannot import bashlex here
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  hookcopy="$d/hooks/api-security-push-guard.sh"
  (asg_payload "$1" "$d/t.jsonl" | ( cd "$d" && run_hook "$hookcopy" )) >/dev/null 2>&1
  rc=$?
  assert_eq "asg: parser absent — $2 [$1]" "$3" "$rc"
  rm -rf "$d"
}
asg_noparser 'rm .claude/.api-edit-pending' 'the documented escape must survive' '0'
asg_noparser 'rm -f .claude/.api-edit-pending' 'the documented escape must survive' '0'
asg_noparser 'ls -la' 'ordinary work must survive' '0'
asg_noparser 'git push origin main' 'containment still catches both tokens' '2'

# git accepts any UNAMBIGUOUS PREFIX of a long option, so matching the full
# spelling is the wrong direction. --remove-s deletes core.hooksPath exactly as
# --remove-section does, and --unset survived only because --uns is ambiguous
# with --unset-all, which is luck, not a predicate.
for asg_abbrev in 'git ls-remote --upload-pa="sh -c evil" ../src' \
                  'git fetch --upload-p="sh -c evil" ../src' \
                  'git send-pack --receive-pa="sh -c evil" ../src' \
                  'git send-pack --receive-pack="sh -c evil" ../src' \
                  'git config --remove-s core' \
                  'git config --unset-a core.hooksPath' \
                  'git difftool --extc="sh -c evil" a b' \
                  'git filter-branch --tree-filter "sh -c evil" HEAD'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_abbrev" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an abbreviated long option blocks like its full spelling [$asg_abbrev]" "2" "$?"
  rm -rf "$d"
done

# -c is a TOP-LEVEL config flag. Screening it record-wide blocked routine branch
# creation, which is the shape that trains bypass on the guard you most need.
for asg_dashc_ok in 'git switch -c feat/x' \
                    'git commit -c HEAD' \
                    'git branch -c old new' \
                    'git checkout -b feat/y' \
                    'git show -c HEAD'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_dashc_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a subcommand short option is not config injection [$asg_dashc_ok]" "0" "$?"
  rm -rf "$d"
done

# ...but a TOP-LEVEL -c still is, in every spelling.
for asg_dashc_block in 'git -c core.hooksPath=/tmp/h commit -m x' \
                       'git -ccore.hooksPath=/tmp/h commit -m x' \
                       'git -c alias.z=push z origin main'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_dashc_block" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a top-level -c is still config injection [$asg_dashc_block]" "2" "$?"
  rm -rf "$d"
done

# A wrapper must not strip rules the bare spelling has. inspect_wrapper used to
# re-implement a SUBSET of inspect, so `env python3 -c ...` skipped the
# inline-interpreter rule that blocks the bare `python3 -c ...`.
for asg_wrapstrip in 'env python3 -c "import os;os.system(0)"' \
                     'sudo python3 -c "import os;os.system(0)"' \
                     'timeout 60 node -e "0"' \
                     'nice -n 10 node -e "0"' \
                     'env -u git git push origin main' \
                     'env "BASH_FUNC_ls%%=() { git push origin main; }" bash -c ls'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_wrapstrip" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a wrapper must not strip a rule the bare form has [$asg_wrapstrip]" "2" "$?"
  rm -rf "$d"
done

# --up is unambiguous for ls-remote, so a 5-char floor let it through.
for asg_shortabbrev in 'git ls-remote --up="sh -c evil" ../src' \
                       'git fetch --upl="sh -c evil" ../src'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_shortabbrev" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: the shortest accepted abbreviation blocks too [$asg_shortabbrev]" "2" "$?"
  rm -rf "$d"
done

# ...and a bare `git` that is an OPERAND is not an invocation.
for asg_gitword_ok in 'rg git' 'echo git' 'which git' 'cat git' 'ls git-hooks'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_gitword_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: git as an operand is not an invocation [$asg_gitword_ok]" "0" "$?"
  rm -rf "$d"
done

# clone/init document --config as the long form of -c. It blocked before this
# test existed, but only as a string-prefix of --config-env, which is an
# accident of spelling rather than a decision — and accidents do not survive
# the next edit to the list.
for asg_cfglong in 'git clone --config core.hooksPath=/tmp/evil . dst' \
                   'git clone --config=core.hooksPath=/tmp/evil . dst' \
                   'git init --config core.hooksPath=/tmp/evil' \
                   'git clone --conf core.hooksPath=/tmp/evil . dst' \
                   'git submodule add --config core.hooksPath=/tmp/evil url path'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_cfglong" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: --config is the long form of -c and blocks like it [$asg_cfglong]" "2" "$?"
  rm -rf "$d"
done

# A wrapper flag that takes a SEPARATE-WORD argument derails positional
# resolution: `env -u HOME sh -c ...` skips -u, then treats HOME as the program
# and stops before the interpreter rules ever run. Interpreters are screened by
# PRESENCE now, the way the git check already was, so where resolution lands
# stops mattering.
for asg_optarg in 'env -u HOME sh -c "git push origin main"' \
                  'sudo -u erik python3 -c "0"' \
                  'timeout -s KILL 5 node -e "0"' \
                  'flock /tmp/l sh -c "git push origin main"' \
                  'xargs -n 1 sh -c "git push"' \
                  'env -S"git push origin main"' \
                  'env --split-string="git push origin main"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_optarg" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a wrapper option argument must not derail resolution [$asg_optarg]" "2" "$?"
  rm -rf "$d"
done

# git's newer read spellings are reads; counting operands scored them as writes.
for asg_cfgread2 in 'git config get user.email' 'git config list' 'git config getall alias.z' \
                    'env -u HOME make build'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_cfgread2" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a config read stays a read [$asg_cfgread2]" "0" "$?"
  rm -rf "$d"
done

# Eight properties shipped with no assertion and survived a reviewer's mutation
# sweep. "Verified before fixing" in a commit body is not a gate.
for asg_unpinned in 'caffeinate git push origin main' \
                    'arch -arm64 git push origin main' \
                    'xcrun git push origin main' \
                    'fish -c "git push origin main"' \
                    'csh -c "git push origin main"' \
                    'git send-pack origin main' \
                    'git http-push origin main' \
                    'PAGER="sh -c evil" git log' \
                    'LESSOPEN="|sh -c evil" git log' \
                    'trap "SIGX; git push origin main" EXIT' \
                    'trap "-x; git push origin main" EXIT'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_unpinned" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: property pinned by an assertion, not a commit message [$asg_unpinned]" "2" "$?"
  rm -rf "$d"
done

# git enforces abbreviation UNIQUENESS itself; the minimum unambiguous length
# varies per subcommand, so no length floor is sound. --u is unique for
# ls-remote and executes.
for asg_shortest in 'git ls-remote --u="sh -c evil" ../src' \
                    'git archive --remote=. --e="sh -c evil" HEAD' \
                    'git config --ed' \
                    'git clone --te=/tmp/evil . dst'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_shortest" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: the shortest spelling git accepts blocks too [$asg_shortest]" "2" "$?"
  rm -rf "$d"
done

# ...and --index is not --index-filter. filter-branch's options are options OF
# filter-branch; screening them globally false-blocked routine stash work.
for asg_filterfp in 'git stash pop --index' \
                    'git stash apply --index' \
                    'git apply --index patch.diff' \
                    'git checkout --theirs file'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_filterfp" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a subcommand flag is not a filter-branch flag [$asg_filterfp]" "0" "$?"
  rm -rf "$d"
done

for asg_filterreal in 'git filter-branch --tree-filter "sh -c evil" HEAD' \
                      'git filter-branch --index-filter "sh -c evil" HEAD'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_filterreal" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: filter-branch's own filters still block [$asg_filterreal]" "2" "$?"
  rm -rf "$d"
done

# bashlex will not classify a %%-bearing word as an assignment, so the BARE
# spelling landed as a program name while the env-wrapped one blocked. The
# wrapped form must never be the stronger one.
for asg_barefunc in 'BASH_FUNC_ls%%="() { git push origin main; }" bash -c ls' \
                    'BASH_FUNC_x%%="() { :; }" bash -c x'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_barefunc" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: the bare spelling is never weaker than the wrapped one [$asg_barefunc]" "2" "$?"
  rm -rf "$d"
done

# Resolution must be POSITIONAL, not by presence. Presence matching failed both
# ways on one line: an interpreter NAME in an operand slot shadowed the real
# shell that followed it, and an interpreter name as a plain argument blocked a
# grep. `env -u` takes an attacker-chosen variable name, so the under-block had
# no precondition at all — the previous fix closed every name EXCEPT the one an
# attacker picks freely.
for asg_operandshadow in 'env -u node bash <<< "git push origin main"' \
                         'env -u python3 bash <<< "git push origin main"' \
                         'env -u perl sh <<< "git push"' \
                         'sudo -u ruby bash <<< "git push origin main"' \
                         'env -u php bash <<< "git push"' \
                         'env -u HOME bash <<< "git push origin main"' \
                         'sudo -u me bash'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_operandshadow" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an operand must not shadow the program [$asg_operandshadow]" "2" "$?"
  rm -rf "$d"
done

# ...and the same rule the other way: an interpreter name that is only an
# ARGUMENT is not an interpreter invocation. Grepping the hooks for `bash` is
# the workflow on this very branch.
for asg_interpword_ok in 'grep -rn bash .claude/hooks/' \
                         'grep -rn sh scripts/' \
                         'rg --files-with-matches bash .claude' \
                         'ls -la /bin/bash' \
                         'which bash' \
                         'cat /etc/shells'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_interpword_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an interpreter name as an argument is not an invocation [$asg_interpword_ok]" "0" "$?"
  rm -rf "$d"
done

# Whether a flag consumes the next word is a property OF THE WRAPPER, not of the
# flag: `sudo -n` is boolean while `nice -n` takes a value, and `sudo -i` is
# boolean while `stdbuf -i` takes one. Assuming every flag takes an operand made
# the resolver skip the PROGRAM, so every boolean-flag spelling walked through.
for asg_boolflag in 'sudo -i bash <<< "git push origin main"' \
                    'env -i bash <<< "git push origin main"' \
                    'sudo -n bash <<< "git push"' \
                    'stdbuf -oL bash <<< "git push"' \
                    'nohup -- bash <<< "git push"' \
                    'env -- bash <<< "git push"' \
                    'sudo -- bash -c "git push"' \
                    'timeout --preserve-status 5 bash <<< "git push"' \
                    'setsid -f bash <<< "git push"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_boolflag" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a boolean wrapper flag must not consume the program [$asg_boolflag]" "2" "$?"
  rm -rf "$d"
done

# ...and the value-taking spellings of the same wrappers still resolve past
# their operand, which is the property the boolean fix must not break.
for asg_valueflag in 'env -u node bash <<< "git push"' \
                     'nice -n 10 bash <<< "git push"' \
                     'timeout -s KILL 5 bash <<< "git push"' \
                     'ionice -c 3 bash <<< "git push"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_valueflag" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a value-taking flag still resolves past its operand [$asg_valueflag]" "2" "$?"
  rm -rf "$d"
done

# A wrapper leading an ordinary command must not resolve onto a shell-named
# ARGUMENT and report undecidable.
for asg_wrapgrep_ok in 'stdbuf -oL grep bash file' \
                       'timeout 30 grep -rn bash docs/' \
                       'nice -n 10 grep -c sh CLAUDE.md'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_wrapgrep_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a wrapper must not resolve onto a shell-named argument [$asg_wrapgrep_ok]" "0" "$?"
  rm -rf "$d"
done

# Every wrapper needs a VALUE_FLAGS row. A missing row inherits the empty
# default, which treats every flag as boolean and FAILS OPEN — `time` shipped
# that way and reopened two spellings the previous commit blocked.
bg_missing=$(python3 - <<'PYEOF'
import re, pathlib
src = pathlib.Path(".claude/hooks/bash-guard-detect.py").read_text()
wrappers = set(re.findall(r'"([a-z]+)"', re.search(r"WRAPPERS = {(.*?)}", src, re.S).group(1)))
keys = set(re.findall(r'^    "([a-z]+)":', re.search(r"VALUE_FLAGS = {(.*?)^}", src, re.S | re.M).group(1), re.M))
print(",".join(sorted(wrappers - keys)))
PYEOF
)
assert_eq "bg: every WRAPPERS entry has a VALUE_FLAGS row (missing rows fail open)" "" "$bg_missing"

# The regression this commit repairs: each of these was blocked two commits ago
# and opened by an incomplete flag table. The last two are flags no table can
# contain, which is why an ambiguous flag now yields BOTH readings.
for asg_tablegap in '/usr/bin/time -o /tmp/x bash <<< \"git push origin main\"' \
                    '/usr/bin/time -f pct bash <<< \"git push origin main\"' \
                    'env -P /usr/bin bash <<< \"git push origin main\"' \
                    'sudo -D /tmp bash <<< \"git push origin main\"' \
                    'sudo -h myhost bash <<< \"git push origin main\"' \
                    'sudo -R /tmp bash <<< \"git push origin main\"' \
                    'exec -a login bash <<< \"git push origin main\"' \
                    'xcrun -sdk macosx bash <<< \"git push origin main\"' \
                    'doas -a style bash <<< \"git push origin main\"' \
                    'script -F pipe bash <<< \"git push origin main\"' \
                    'watch -d bash <<< \"git push origin main\"' \
                    'sudo --zzz-unknown val bash <<< \"git push origin main\"' \
                    'env --no-such-flag val bash <<< \"git push origin main\"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_tablegap" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a flag-table gap must not open a wrapper [$asg_tablegap]" "2" "$?"
  rm -rf "$d"
done

# These use NON-NUMERIC operands on purpose. The earlier `nice -n 10` and
# `ionice -c 3` cases passed for the wrong reason: WRAPPER_OPERAND absorbs a
# numeric operand, so they never consulted VALUE_FLAGS at all and stayed green
# with the row deleted.
for asg_nonnumeric in 'env -u node bash <<< \"git push origin main\"' \
                      'timeout -s KILL 5 bash <<< \"git push origin main\"' \
                      'nice --adjustment high bash <<< \"git push origin main\"' \
                      'stdbuf -o L bash <<< \"git push origin main\"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_nonnumeric" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a non-numeric operand actually exercises the flag table [$asg_nonnumeric]" "2" "$?"
  rm -rf "$d"
done

# An ATTACHED short flag already carries its value, so it must not widen the
# candidate set onto a shell-named argument.
for asg_attached_ok in 'stdbuf -oL grep bash file' \
                       'timeout 30 grep -rn bash docs/'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_attached_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an attached short flag must not widen onto an argument [$asg_attached_ok]" "0" "$?"
  rm -rf "$d"
done

# The candidate widening is exponential in consecutive ambiguous flags —
# 2^k, so a ~175-character command hangs the hook and MAX_CMD_LEN (100k) bounds
# nothing, since the cost grows with the SHAPE of the input, not its length.
# A budget bounds it the way reparse already bounds its own recursion.
asg_dos="env -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 bash <<< \"git push origin main\""
d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
# Bound the CALL, not the elapsed time after it. Measuring afterwards cannot
# fail on a hang — the budget-removed mutant never returns, so `date` is never
# reached and the fail branch is unreachable. `timeout(1)` is absent on darwin,
# so perl's alarm is the portable bound; it exits 142 on expiry, which is not 2.
(asg_payload "$asg_dos" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
asg_rc=$?
assert_eq "asg: an exponential payload blocks within the bound, never hangs" "2" "$asg_rc"
rm -rf "$d"

# timeout takes 5, 1.5, 0.5s and 2h30m. Enumerating duration SHAPES loses the
# same way enumerating flags did, so any digit-leading token is an operand.
for asg_duration in 'timeout 1.5 bash <<< \"git push origin main\"' \
                    'timeout 0.5s bash <<< \"git push origin main\"' \
                    'timeout 2h30m bash <<< \"git push origin main\"' \
                    'timeout 5 bash <<< \"git push origin main\"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_duration" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a duration operand must not end resolution [$asg_duration]" "2" "$?"
  rm -rf "$d"
done

# The classic budget mistake: exhaustion returned an empty candidate list, which
# the gate reads as "no shell here". Burn the budget with cheap ambiguous flags,
# then place the shell where only a WIDENED candidate reaches it (`--zzz val
# bash` resolves to `val` on the primary walk), and the payload walks through.
# Exhaustion means the walk could not finish, which is undecidable.
for asg_widen_only in 'sudo --zzz val bash <<< \"git push origin main\"' \
                  'sudo -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 --zzz val bash <<< \"git push origin main\"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_widen_only" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an ambiguous flag must yield both readings [$asg_widen_only]" "2" "$?"
  rm -rf "$d"
done

# The budget is process-global, so the real boundary is CROSS-COMMAND: drain it
# in the first command, then run the payload in a second node whose top-level
# call is refused entry. `;`, `&&` and `|` all create that boundary cheaply.
for asg_starve2 in 'env -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 true ; bash <<< \"git push origin main\"' \
                   'env -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 true && bash <<< \"git push origin main\"' \
                   'env -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 -a A=1 true | bash <<< \"git push origin main\"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_starve2" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a drained budget must not open the NEXT command" "2" "$?"
  rm -rf "$d"
done

# env -S takes the command ATTACHED or in the next word. Only the attached form
# was covered, and the separated form did worse than miss: sub() left an empty
# payload, reparse("") was a no-op, and the branch returned — abandoning the
# whole wrapper scan.
for asg_splitsep in 'env -S "git push origin main"' \
                    'env --split-string "git push origin main"' \
                    'env -S"git push origin main"' \
                    'env --split-string="git push origin main"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_splitsep" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: env -S blocks attached AND separated [$asg_splitsep]" "2" "$?"
  rm -rf "$d"
done

# filter-branch --setup runs its argument through sh once before the loop, the
# same execution class as the seven *-filter options the family already covers.
for asg_fbsetup in 'git filter-branch --setup "git push origin main" -- HEAD' \
                   'git filter-branch --setup "sh -c evil" HEAD' \
                   'git filter-branch --setu "sh -c evil" HEAD'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_fbsetup" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: filter-branch --setup executes shell, so it blocks [$asg_fbsetup]" "2" "$?"
  rm -rf "$d"
done

# -u and -x are only --upload-pack / --exec for specific subcommands. Screening
# them globally blocked `git add -u` — the staging spelling CLAUDE.md mandates —
# and every marker-pending window is exactly when API work is happening.
for asg_shortflag_ok in 'git add -u' 'git add -u lib/foo.ts' 'git diff -u' \
                        'git log -u' 'git stash -u' 'git clean -x -n'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_shortflag_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a short flag is not --exec outside its subcommand [$asg_shortflag_ok]" "0" "$?"
  rm -rf "$d"
done

# ...but they ARE exec/upload-pack where git says they are.
for asg_shortflag_block in 'git fetch -u ./up .' 'git rebase -x "git push" HEAD~1'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_shortflag_block" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: -u/-x block in the subcommands that exec [$asg_shortflag_block]" "2" "$?"
  rm -rf "$d"
done

# A nested wrapper rebinds the flag tables: -S is env's meaning, not sudo's.
for asg_nestwrap in 'sudo env -S "git push origin main"' \
                    'nice env -S "git push origin main"' \
                    'watch bash -c "git push origin main"' \
                    'parallel sh -c "git push origin main"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_nestwrap" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a nested wrapper rebinds the flag tables [$asg_nestwrap]" "2" "$?"
  rm -rf "$d"
done

# A word with no `=` is not an assignment. `is_config_assign` used to split on
# `=`, get the whole word back as the "name", and then match a bare `$` in it —
# so any wrapped command carrying a dollar sign in an argument emitted #assign
# and blocked. Commit messages with prices are the common case.
for asg_dollar_ok in 'sudo git commit -m "cost is $5 for the API key"' \
                     'env git commit -m "price: $9.99"' \
                     'sudo git log --grep "$HOME"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_dollar_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a dollar sign in an argument is not an assignment [$asg_dollar_ok]" "0" "$?"
  rm -rf "$d"
done

# ...while an assignment whose NAME is computed still blocks, which is the
# property the opaque check exists for.
for asg_dollar_block in 'export $A=1 $B=alias.z $C=push' \
                        'declare $VAR=core.hooksPath'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_dollar_block" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an opaque assignment NAME still blocks [$asg_dollar_block]" "2" "$?"
  rm -rf "$d"
done

# The wrapper payload/operand vectors, pinned. Review was right that the commit
# claiming them had no assertion driving any of them through the hook.
for asg_wrapperpayload in 'flock /tmp/l -c "git push origin main"' \
                          'script -c "git push origin main" /dev/null' \
                          'watch -n 1 "git push origin main"' \
                          'parallel -S host bash -c "git push origin main"'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_wrapperpayload" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a wrapper's own payload flag is reparsed [$asg_wrapperpayload]" "2" "$?"
  rm -rf "$d"
done

# These are pinned on bash-guard.sh specifically. The push-guard fails closed on
# exit 3 for the same inputs, so an asg assertion passes whether or not the
# payload was ever read — which is how the operand branch shadowed the
# interpreter branches while the suite stayed green.
assert_eq "bg: watch bash -c reaches the payload" "2" "$(bg_exit "watch bash -c 'git push --force origin main'")"
assert_eq "bg: parallel bash -c reaches the payload" "2" "$(bg_exit "parallel bash -c 'git push --force origin main'")"
assert_eq "bg: watch sh -c reaches the payload" "2" "$(bg_exit "watch sh -c 'npm install'")"
assert_eq "bg: parallel sh -c reaches the payload" "2" "$(bg_exit "parallel sh -c 'gh pr merge 1'")"
assert_eq "bg: watch eval reaches the payload" "2" "$(bg_exit "watch eval 'git push --force origin main'")"
assert_eq "bg: flock -c reaches the payload" "2" "$(bg_exit "flock /tmp/l -c 'git push --force origin main'")"
assert_eq "bg: a watch operand that IS a shell string still reparses" "2" "$(bg_exit "watch -n 1 'git push --force origin main'")"
assert_eq "bg: ordinary watch is untouched" "0" "$(bg_exit "watch -n 1 date")"
assert_eq "bg: ordinary parallel is untouched" "0" "$(bg_exit "parallel echo ::: a b")"

# An opaque PROGRAM word is undecidable wherever it sits. visitcommand guards
# words[0], but a wrapper displaces position 0. This used to be caught only as a
# side effect of is_config_assign treating a word with no `=` as an assignment
# name — so fixing that false positive silently removed it. Now held directly.
for asg_opaqueprog in 'sudo $G origin main' \
                      'env $CMD origin main' \
                      'nice $CMD origin main' \
                      'timeout 5 $CMD origin main' \
                      'sudo $P/g origin main' \
                      'env $D/x push' \
                      'sudo -u root $CMD push' \
                      'env -u FOO $CMD push' \
                      'timeout -s TERM $CMD push' \
                      'env -u FOO sudo -u root $CMD push'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_opaqueprog" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: an opaque program word is undecidable behind a wrapper [$asg_opaqueprog]" "2" "$?"
  rm -rf "$d"
done

# Ordinary environment work is not git configuration.
for asg_env_ok in 'PATH=/x:$PATH make build' 'NODE_ENV=production pnpm build' 'export NODE_ENV=production' 'FOO=bar git status'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_env_ok" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: a non-git assignment is not config injection [$asg_env_ok]" "0" "$?"
  rm -rf "$d"
done

for asg_persist in 'git config core.hooksPath /tmp/h' \
                   'git config --local core.hooksPath /tmp/h' \
                   'git config alias.z "push origin main"' \
                   'git config --add alias.z push' \
                   'git --git-dir=/tmp/evil/.git status' \
                   'git --git-dir /tmp/evil/.git fetch' \
                   'git --work-tree=/tmp/evil status' \
                   'env GIT_CONFIG_KEY_0=alias.foo GIT_CONFIG_VALUE_0=push GIT_CONFIG_COUNT=1 git foo'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_persist" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: persistent or redirected config blocks [$asg_persist]" "2" "$?"
  rm -rf "$d"
done

# Reading config is not writing it.
for asg_cfgread in 'git config --get remote.origin.url' 'git config --list' 'git config user.name' \
                   'git -C /tmp/other status' 'git -C /tmp/other log --oneline'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_cfgread" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: reading config stays allowed [$asg_cfgread]" "0" "$?"
  rm -rf "$d"
done

for asg_cfginj in 'git -c $CFG' \
                  'git -c user.name=x commit -m y' \
                  'git -c include.path=/tmp/x.cfg commit -m wip' \
                  'git -c core.sshCommand="sh -c x" fetch origin' \
                  'GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/tmp/h GIT_CONFIG_COUNT=1 git commit -m wip'; do
  d=$(asg_mkroot)
  printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
  (asg_payload "$asg_cfginj" "$d/t.jsonl" | ( cd "$d" && asg_hook )) >/dev/null 2>&1
  assert_eq "asg: config injection blocks while a marker pends [$asg_cfginj]" "2" "$?"
  rm -rf "$d"
done

det_bad='bash -c "echo (("'
det_rc=$(python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command": sys.argv[1]}}))' "$det_bad" \
  | run_py "$HOOKS/bash-guard-detect.py" --emit-commands >/dev/null 2>&1; echo $?)
assert_eq "det: unparseable inner payload exits 3 (undecidable), not 1 (crash)" "3" "$det_rc"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"cwd":"x\\", command git push, "y":"end"}' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: an odd trailing backslash must not let the strip eat a real push" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"rm .claude/.api-edit-pending","description":"say \\"ok\\" git push can proceed"},"transcript' | ( cd "$d" && asg_hook )) >/dev/null 2>&1
assert_eq "asg: an escaped quote leaves a token tail — accepted over-block, never a bypass" "2" "$?"
rm -rf "$d"

ASG_TOKEN_PATH='/Users/x/git/push-service/t.jsonl'

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload 'rm .claude/.api-edit-pending' "$ASG_TOKEN_PATH" | ( cd "$d" && PATH="$PYSHIM:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: the documented escape survives a transcript_path carrying both tokens" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(asg_payload 'ls -la' "$ASG_TOKEN_PATH" | ( cd "$d" && PATH="$PYSHIM:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: unrelated command survives a transcript_path carrying both tokens" "0" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"tool_input":{"command":"git push origin main"},"transcript_path":"%s"' "$ASG_TOKEN_PATH" | ( cd "$d" && PATH="$PYSHIM:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: a real push still blocks once path tokens are excluded" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"transcript_path":"/t.jsonl","cwd":"/repo""tool_input":{"command":"git push origin main"}}' | ( cd "$d" && PATH="$PYSHIM:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: a path field missing its trailing comma cannot swallow the command" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"cwd":"/repo","transcript_path":"/t.jsonl""tool_input":{"command":"git push origin main"}}' | ( cd "$d" && PATH="$PYSHIM:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: same bleed via transcript_path ahead of the command" "2" "$?"
rm -rf "$d"

d=$(asg_mkroot)
printf '2020-01-01T00:00:00.000Z\tabc123\tapp/api/route.ts\n' > "$d/.claude/.api-edit-pending"
(printf '{"cwd":"%s","tool_input":{"command":"ls -la"},"transcript_path":"/t.jsonl"' "/Users/x/git/push-service" | ( cd "$d" && PATH="$PYSHIM:$PATH" asg_hook )) >/dev/null 2>&1
assert_eq "asg: cwd is excluded too — it is the likelier token-bearing path" "0" "$?"
rm -rf "$d"
rm -rf "$PYSHIM"


# --- self-check: the bound above must actually cover every invocation --------
# A comment claiming coverage is worth nothing. This keys on the TARGET (any
# line naming a hook path) rather than on shell command position, which is an
# unbounded set — an earlier cut anchored on it and silently lost `if`, `while`,
# `FOO=1 `, `exec`, `time`, backticks and `{`. The verbs that take a hook path as
# DATA are few and stable, so they are excluded by name instead.
unbounded=$(grep -vE '^[[:space:]]*#' "$0" \
  | grep -vE '(run_hook|run_py|_run_bounded)' \
  | grep -vE '^[[:space:]]*(cp|mv|cat|rm|chmod|diff|dirname|printf|echo|grep|sed|ln|mkdir|touch)[[:space:]]' \
  | grep -vE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*="?\$\{?(HOOKS|[A-Z_]*_HOOK)' \
  | grep -cE '\$\{?(HOOKS[}/]|[A-Z_]*_HOOK|hookcopy)' || true)
assert_eq "meta: every hook invocation is time-bounded (no bare bash/python3 call)" "0" "$unbounded"

[ "$FAILED" -eq 0 ] && { printf '\nALL PASS\n'; exit 0; } || { printf '\nFAILURES\n'; exit 1; }
