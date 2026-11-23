#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "${ROOT}/scripts/e2e/webkit-stall-probe.mjs" "$@"
