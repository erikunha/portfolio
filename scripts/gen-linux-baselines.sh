#!/usr/bin/env bash
# scripts/gen-linux-baselines.sh
#
# Regenerate the Linux visual-regression baselines LOCALLY, inside the pinned
# Playwright Docker image that matches CI's ubuntu-latest runner. This lets a
# visual-affecting change ship both darwin and linux baselines in ONE commit, so
# the PR's first CI run is green — instead of: push (CI fails on stale linux
# baselines) -> dispatch update_visual_baselines -> push again. Paid CI runs are
# not a baseline-detection tool. See CLAUDE.md "Regenerate ALL affected baselines
# BEFORE the push".
#
# Usage:  pnpm baselines:linux
# Then:   git status tests/e2e/visual.spec.ts-snapshots/  (inspect, commit the
#         changed *-linux.png alongside your darwin baselines + code).
#
# Requires Docker. The container does a clean linux install + build + serve +
# `playwright test visual --update-snapshots` so the rendering env matches CI.
set -euo pipefail
cd "$(dirname "$0")/.."

PW_VERSION="$(node -e "console.log(require('playwright/package.json').version)")"
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"

echo "[gen-linux-baselines] image: ${IMAGE}"
# Bind-mount the repo so regenerated baselines land back on the host, BUT mask
# node_modules and .next with container-only anonymous volumes so the Linux
# `pnpm install`/`pnpm build` never overwrite the host's (darwin) node_modules
# or build output. Only the snapshot PNGs under tests/ are written through.
docker run --rm \
  -v "$PWD":/work \
  -v /work/node_modules \
  -v /work/.next \
  -w /work "${IMAGE}" bash -euo pipefail -c '
  corepack enable
  pnpm install --frozen-lockfile
  pnpm build
  DEPLOY_SALT=ci-build-salt pnpm start &
  npx wait-on http://localhost:3000 --timeout 60000
  pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots
'
echo "[gen-linux-baselines] done. Inspect + commit the changed *-linux.png:"
git status --short tests/e2e/visual.spec.ts-snapshots/
