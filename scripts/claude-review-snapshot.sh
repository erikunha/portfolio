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

checks_status=0
gh pr checks "$PR" --repo "$REPO" > "$OUT_DIR/checks.txt" 2> "$OUT_DIR/checks.err" || checks_status=$?
case "$checks_status" in
  0 | "$GH_PR_CHECKS_FAILED" | "$GH_PR_CHECKS_PENDING") rm -f "$OUT_DIR/checks.err" ;;
  *)
    {
      echo "UNAVAILABLE: gh pr checks exited $checks_status; check results could not be read."
      cat "$OUT_DIR/checks.err"
    } > "$OUT_DIR/checks.txt"
    rm -f "$OUT_DIR/checks.err"
    ;;
esac

run_ids=$(gh run list --repo "$REPO" --commit "$head_sha" --status failure --limit 100 \
  --json databaseId --jq '.[].databaseId')
for run_id in $run_ids; do
  full="$OUT_DIR/.failed-run-${run_id}.full"
  gh run view "$run_id" --repo "$REPO" --log-failed > "$full" 2>&1 || true
  head -c "$MAX_LOG_BYTES" "$full" > "$OUT_DIR/failed-run-${run_id}.log"
  rm -f "$full"
done
