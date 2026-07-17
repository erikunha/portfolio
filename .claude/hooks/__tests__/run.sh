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
  printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | bash "$BIOME_HOOK" >/dev/null 2>&1
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
printf '{"tool_input":{"file_path":"%s"}}' "$tmd" | bash "$BIOME_HOOK" >/dev/null 2>&1
assert_eq "format: .md skipped (no write)" "$mdbefore" "$(cat "$tmd")"
rm -f "$tmd"

SC_HOOK="$HOOKS/session-context.sh"

out=$(cd "$REPO_ROOT" && printf '' | bash "$SC_HOOK")
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
out_fb=$(cd "$REPO_ROOT" && printf '' | PATH="$SHIM:$PATH" bash "$SC_HOOK")
assert_contains "ctx-fallback: still emits envelope" "$out_fb" '"hookEventName":"SessionStart"'
assert_contains "ctx-fallback: branch retained"      "$out_fb" 'branch:'
assert_not_contains "ctx-fallback: CI line omitted"  "$out_fb" 'last CI:'
rm -rf "$SHIM"

NOREPO=$(mktemp -d)
out_nr=$(cd "$NOREPO" && printf '' | bash "$SC_HOOK")
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
( cd "$(mktemp -d)" && printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | bash "$HOOKS/biome-format.sh" ) >/dev/null 2>&1
ec=$?
assert_eq "guard: biome-missing exit 0" "0" "$ec"
assert_eq "guard: biome-missing file untouched" "$before" "$(cat "$tmp")"
rm -f "$tmp"

gone="$FIXDIR/bf-gone-$$.ts"
printf '{"tool_input":{"file_path":"%s"}}' "$gone" | bash "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: missing-file exit 0" "0" "$?"

printf 'not json at all' | bash "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: biome malformed-stdin exit 0" "0" "$?"
printf 'not json at all' | bash "$HOOKS/session-context.sh" >/dev/null 2>&1
assert_eq "guard: session malformed-stdin exit 0" "0" "$?"

( cd "$REPO_ROOT" && printf '' | bash "$HOOKS/session-context.sh" ) >/dev/null 2>&1
assert_eq "guard: session-context exit 0" "0" "$?"

# --- bash-guard.sh block logic (the broadest blocking hook; previously untested) ---
BG_HOOK="$HOOKS/bash-guard.sh"
bg_exit() { # $1=command string -> exit code of bash-guard for a well-formed payload
  python3 -c 'import json,sys; print(json.dumps({"command": sys.argv[1]}))' "$1" | bash "$BG_HOOK" >/dev/null 2>&1
  echo $?
}
assert_eq "bg: broad 'git add -A' blocked" "2" "$(bg_exit 'git add -A')"
assert_eq "bg: 'git add .' blocked"        "2" "$(bg_exit 'git add .')"
assert_eq "bg: npm blocked"                 "2" "$(bg_exit 'npm install foo')"
assert_eq "bg: 'gh pr merge' blocked"       "2" "$(bg_exit 'gh pr merge 42 --squash')"
assert_eq "bg: force-push main blocked"     "2" "$(bg_exit 'git push --force origin main')"
assert_eq "bg: safe 'git status' allowed"   "0" "$(bg_exit 'git status')"
assert_eq "bg: 'git add -u' allowed"        "0" "$(bg_exit 'git add -u')"
# fail-closed: a malformed (non-JSON) payload carrying a dangerous command must STILL block
printf 'gh pr merge 42' | bash "$BG_HOOK" >/dev/null 2>&1
assert_eq "bg: fail-closed on malformed payload (gh pr merge)" "2" "$?"
printf 'git push --force origin main' | bash "$BG_HOOK" >/dev/null 2>&1
assert_eq "bg: fail-closed on malformed payload (force-push main)" "2" "$?"
# a malformed but safe payload must NOT block (no over-blocking of ordinary commands)
printf 'just some prose with no dangerous command' | bash "$BG_HOOK" >/dev/null 2>&1
assert_eq "bg: malformed safe payload allowed" "0" "$?"

# --- api-edit-marker.sh block logic (isolated in a temp non-git dir; real marker untouched) ---
AEM_HOOK="$HOOKS/api-edit-marker.sh"
aem_marked() { # $1=file_path -> MARKED|NONE (marker written to an isolated temp ROOT)
  local d; d=$(mktemp -d)
  printf '{"tool_input":{"file_path":"%s"}}' "$1" | ( cd "$d" && bash "$AEM_HOOK" >/dev/null 2>&1 )
  if [ -s "$d/.claude/.api-edit-pending" ]; then printf 'MARKED'; else printf 'NONE'; fi
  rm -rf "$d"
}
assert_eq "aem: app/api path marked"  "MARKED" "$(aem_marked /repo/app/api/ask/route.ts)"
assert_eq "aem: rate-limit.ts marked" "MARKED" "$(aem_marked /repo/lib/rate-limit.ts)"
assert_eq "aem: proxy.ts marked"      "MARKED" "$(aem_marked /repo/proxy.ts)"
assert_eq "aem: non-API not marked"   "NONE"   "$(aem_marked /repo/components/sections/Hero.tsx)"
# fail-closed: a malformed payload mentioning an API path must STILL record a marker
aem_d=$(mktemp -d)
printf 'garbled non-json app/api/ask/route.ts payload' | ( cd "$aem_d" && bash "$AEM_HOOK" >/dev/null 2>&1 )
if [ -s "$aem_d/.claude/.api-edit-pending" ]; then aem_fc=MARKED; else aem_fc=NONE; fi
rm -rf "$aem_d"
assert_eq "aem: fail-closed on malformed payload with API path" "MARKED" "$aem_fc"

[ "$FAILED" -eq 0 ] && { printf '\nALL PASS\n'; exit 0; } || { printf '\nFAILURES\n'; exit 1; }
