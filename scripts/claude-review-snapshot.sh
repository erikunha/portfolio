#!/usr/bin/env bash
set -euo pipefail

: "${REPO:?REPO is required}"
: "${PR:?PR is required}"
: "${OUT_DIR:?OUT_DIR is required}"
MAX_LOG_BYTES="${MAX_LOG_BYTES:-60000}"
GH_PR_CHECKS_FAILED=1
GH_PR_CHECKS_PENDING=8

mkdir -p "$OUT_DIR"

gh pr view "$PR" --repo "$REPO" --json number,headRefOid,baseRefName,headRefName,title \
  > "$OUT_DIR/pr.json"
head_sha=$(gh pr view "$PR" --repo "$REPO" --json headRefOid --jq .headRefOid)

gh pr diff "$PR" --repo "$REPO" > "$OUT_DIR/diff.patch"
gh pr diff "$PR" --repo "$REPO" --name-only > "$OUT_DIR/files.txt"

checks_status=0
gh pr checks "$PR" --repo "$REPO" --json name,state,bucket,link \
  > "$OUT_DIR/checks.json" 2> "$OUT_DIR/checks.err" || checks_status=$?
checks_valid=false
case "$checks_status" in
  0 | "$GH_PR_CHECKS_FAILED" | "$GH_PR_CHECKS_PENDING")
    if jq -e 'type == "array" and length > 0' "$OUT_DIR/checks.json" > /dev/null 2>&1; then
      checks_valid=true
    fi
    ;;
esac
if [ "$checks_valid" = true ]; then
  jq -r '.[] | [.bucket, .state, .name, .link] | @tsv' "$OUT_DIR/checks.json" > "$OUT_DIR/checks.txt"
else
  {
    echo "UNAVAILABLE: gh pr checks exited $checks_status without a readable check list."
    cat "$OUT_DIR/checks.err"
  } > "$OUT_DIR/checks.txt"
fi
rm -f "$OUT_DIR/checks.err" "$OUT_DIR/checks.json"

run_ids=$(gh run list --repo "$REPO" --commit "$head_sha" --status failure --limit 100 \
  --json databaseId --jq '.[].databaseId')
for run_id in $run_ids; do
  full="$OUT_DIR/.failed-run-${run_id}.full"
  gh run view "$run_id" --repo "$REPO" --log-failed > "$full" 2>&1 || true
  head -c "$MAX_LOG_BYTES" "$full" > "$OUT_DIR/failed-run-${run_id}.log"
  rm -f "$full"
done
