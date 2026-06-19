#!/usr/bin/env bash
# Greenfield bash-hook behavioral test runner for .claude/hooks/.
# Pipes mock tool-input JSON to a hook on stdin and asserts on observable
# output / file state (STANDARDS Ch.4: behavioral, no source-grep). Exits
# non-zero on the first failed assertion. No Vitest dependency — hooks are bash,
# the harness is bash. History: created 2026-06-19 with the fast-feedback hooks
# (Unit A) — the repo had no bash-hook test harness before this.
#
# Fixtures are GENERATED AT RUN TIME into a mktemp dir OUTSIDE the repo working
# tree (mktemp -d defaults to /tmp), so deliberately-malformed `.ts` content
# never reaches the repo's `biome check .` pre-commit gate. The committed tree
# carries no fixture files and no biome.json ignore deviation.
set -u
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
HOOKS="$REPO_ROOT/.claude/hooks"
FAILED=0

# Run-time fixture scratch dir, cleaned on any exit. Lives in /tmp, never the repo.
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

# ── fixtures (written at run time, deliberately malformed where noted) ────────
# messy.ts: cramped spacing — Biome's formatter must rewrite it.
cat > "$FIXDIR/messy.ts" <<'EOF'
export const greet=(name:string)=>{
return  `hi ${name}`
}
EOF
# unordered-imports.ts: zod imported before next/server — the assist reorders.
cat > "$FIXDIR/unordered-imports.ts" <<'EOF'
import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";

export function handler(_req: NextRequest) {
  const schema = z.object({ ok: z.boolean() });
  return NextResponse.json(schema.parse({ ok: true }));
}
EOF
# unused-import.ts: readFileSync is imported but never used — must SURVIVE
# (linter disabled in the hook, so no semantic mutation).
cat > "$FIXDIR/unused-import.ts" <<'EOF'
import { readFileSync } from "node:fs";

export const ANSWER = 42;
EOF
# clean.ts: already Biome-clean — must come back byte-identical.
cat > "$FIXDIR/clean.ts" <<'EOF'
export const ANSWER = 42;
EOF

# ── biome-format.sh ──────────────────────────────────────────────────────────
BIOME_HOOK="$HOOKS/biome-format.sh"
run_format() { # fixture-basename -> echoes the temp file path after the hook ran
  local tmp; tmp=$(mktemp "$FIXDIR/bf.XXXXXX").ts
  cp "$FIXDIR/$1" "$tmp"
  printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | bash "$BIOME_HOOK" >/dev/null 2>&1
  printf '%s' "$tmp"
}

# 1. messy .ts is left Biome-clean (formatting applied -> file changed).
t=$(run_format messy.ts)
before=$(cat "$FIXDIR/messy.ts"); after=$(cat "$t")
if [ "$before" != "$after" ]; then pass "format: messy reformatted"; else fail "format: messy unchanged"; fi
# and the result is idempotent under a second biome pass (truly clean):
"$REPO_ROOT/node_modules/.bin/biome" check --write --linter-enabled=false --no-errors-on-unmatched "$t" >/dev/null 2>&1
assert_eq "format: messy now idempotent" "$after" "$(cat "$t")"
rm -f "$t"

# 2. out-of-order imports are organized (assist runs -> next/server sorts before zod is moot;
#    assert the file changed AND zod import still present).
t=$(run_format unordered-imports.ts)
after=$(cat "$t")
if [ "$(cat "$FIXDIR/unordered-imports.ts")" != "$after" ]; then pass "format: imports organized"; else fail "format: imports not organized"; fi
assert_contains "format: zod import retained" "$after" "from 'zod'"
rm -f "$t"

# 3. unused import SURVIVES (linter disabled -> no semantic mutation).
t=$(run_format unused-import.ts)
assert_contains "format: unused import retained (linter off)" "$(cat "$t")" "readFileSync"
rm -f "$t"

# 4. already-clean file is byte-identical after.
t=$(run_format clean.ts)
assert_eq "format: clean is idempotent" "$(cat "$FIXDIR/clean.ts")" "$(cat "$t")"
rm -f "$t"

# 5. .md path -> Biome never invoked (file unchanged even though content is non-TS).
tmd=$(mktemp "$FIXDIR/bf.XXXXXX").md
printf '# Title\n\n  badly   spaced markdown\n' > "$tmd"
mdbefore=$(cat "$tmd")
printf '{"tool_input":{"file_path":"%s"}}' "$tmd" | bash "$BIOME_HOOK" >/dev/null 2>&1
assert_eq "format: .md skipped (no write)" "$mdbefore" "$(cat "$tmd")"
rm -f "$tmd"

# ── session-context.sh ───────────────────────────────────────────────────────
SC_HOOK="$HOOKS/session-context.sh"

# 1. Inside the repo: emits the exact envelope shape + core git fields.
out=$(cd "$REPO_ROOT" && printf '' | bash "$SC_HOOK")
assert_contains "ctx: hookEventName envelope" "$out" '"hookEventName":"SessionStart"'
assert_contains "ctx: hookSpecificOutput key" "$out" '"hookSpecificOutput"'
assert_contains "ctx: additionalContext key"  "$out" '"additionalContext"'
assert_contains "ctx: marker line"            "$out" '[session-context]'
assert_contains "ctx: branch field"           "$out" 'branch:'
assert_contains "ctx: uncommitted field"      "$out" 'uncommitted:'
# Valid single-line JSON object (python parses it).
if printf '%s' "$out" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  pass "ctx: valid JSON"
else
  fail "ctx: not valid JSON"
fi

# 2. gh failing (PATH shim) -> git-only fallback, still valid envelope, no CI line.
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

# 3. Outside a git repo -> emits nothing.
NOREPO=$(mktemp -d)
out_nr=$(cd "$NOREPO" && printf '' | bash "$SC_HOOK")
assert_eq "ctx: empty outside repo" "" "$out_nr"
rm -rf "$NOREPO"

# ── settings.json wiring ─────────────────────────────────────────────────────
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

# ── §4 failure-mode guards ───────────────────────────────────────────────────
# (a) biome binary missing -> hook exits 0, file untouched. Simulate by pointing
#     the hook at a temp REPO_ROOT with no node_modules via a subshell cd.
tmp=$(mktemp "$FIXDIR/bf.XXXXXX").ts; cp "$FIXDIR/messy.ts" "$tmp"; before=$(cat "$tmp")
( cd "$(mktemp -d)" && printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | bash "$HOOKS/biome-format.sh" ) >/dev/null 2>&1
ec=$?
assert_eq "guard: biome-missing exit 0" "0" "$ec"
assert_eq "guard: biome-missing file untouched" "$before" "$(cat "$tmp")"
rm -f "$tmp"

# (b) file deleted before hook -> exit 0, no error.
gone="$FIXDIR/bf-gone-$$.ts"
printf '{"tool_input":{"file_path":"%s"}}' "$gone" | bash "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: missing-file exit 0" "0" "$?"

# (c) malformed stdin JSON -> both hooks exit 0, no crash.
printf 'not json at all' | bash "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: biome malformed-stdin exit 0" "0" "$?"
printf 'not json at all' | bash "$HOOKS/session-context.sh" >/dev/null 2>&1
assert_eq "guard: session malformed-stdin exit 0" "0" "$?"

# (d) session-context exit code is 0 even inside the repo.
( cd "$REPO_ROOT" && printf '' | bash "$HOOKS/session-context.sh" ) >/dev/null 2>&1
assert_eq "guard: session-context exit 0" "0" "$?"

[ "$FAILED" -eq 0 ] && { printf '\nALL PASS\n'; exit 0; } || { printf '\nFAILURES\n'; exit 1; }
